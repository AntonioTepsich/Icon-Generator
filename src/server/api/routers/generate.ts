import { TRPCError } from "@trpc/server";
import { string, z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { Configuration, OpenAIApi } from "openai"
import { env } from "~/env.mjs"
import { b64Image } from "~/data/b64Image";
import AWS from "aws-sdk";

const s3 = new AWS.S3({
    accessKeyId: env.ACCESS_KEY_ID,
    secretAccessKey: env.SECRET_ACCESS_KEY,
    region: env.REGION,
});


const configuration = new Configuration({
    apiKey: env.DALLE_API_KEY
});
const openai = new OpenAIApi(configuration);


async function generateIcon(prompt: string, numberToGenerate=1){
    if(env.MOCK_DALLE === "true") {
        return new Array<string>(numberToGenerate).fill(b64Image);
    } else{
        const response = await openai.createImage({
            prompt,
            n: numberToGenerate,
            size: "512x512",
            response_format: "b64_json",
        });

        return response.data.data.map((result)=>result.b64_json || "");
    }

}

export const generateRouter = createTRPCRouter({
    generateIcon: protectedProcedure
        .input(z.object({
            prompt: z.string(),
            color: z.string(),
            shape: z.string(),
            numberToGenerate: z.number().min(1).max(10),
        })
    )
    .mutation(async ({ctx, input}) => {
        const {count} = await ctx.prisma.user.updateMany({
            where: {
                id: ctx.session.user.id,
                credits: {
                    gte: 1,
                },
            },
            data: {
                credits: {
                    decrement: 1,
                },
            }
        });

        if (count <= 0) {
            throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Not enough credits',
            });
        }

        const finalPrompt = `a modern ${input.shape} icon in ${input.color} of ${input.prompt}, 3d rendered`;

        const base64EnCodedImages = await generateIcon(finalPrompt, input.numberToGenerate);

        const createdIcons = await Promise.all(base64EnCodedImages.map(async (image) => {
            const icon = await ctx.prisma.icon.create({
                data: {
                    prompt: input.prompt,
                    userId: ctx.session.user.id,
                },
            });
            await s3.putObject({
                Bucket: env.BUCKET_NAME,
                Body: Buffer.from(image, 'base64'),
                Key: icon.id,
                ContentEncoding: 'base64',
                ContentType: 'image/png',
            }).promise();
            return icon;
        }));



        return createdIcons.map((icon) => {
            return {
                imageUrl: `https://${env.BUCKET_NAME}.s3.${env.REGION}.amazonaws.com/${icon.id}`,
            }
        });
    })
});
