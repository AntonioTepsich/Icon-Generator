import { TRPCError } from "@trpc/server";
import { string, z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { Configuration, OpenAIApi } from "openai"
import { env } from "~/env.mjs"
import { b64Image } from "~/data/b64Image";
import AWS from "aws-sdk";

const s3 = new AWS.S3({
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    region: env.AWS_REGION,
});


const configuration = new Configuration({
    apiKey: env.DALLE_API_KEY
});
const openai = new OpenAIApi(configuration);


async function generateIcon(prompt: string): Promise<string | undefined> {
    if(env.MOCK_DALLE === "true") {
        return b64Image;
    } else{
        const response = await openai.createImage({
            prompt,
            n: 1,
            size: "512x512",
            response_format: "b64_json",
        });

        return response.data.data[0]?.b64_json;
    }

}

export const generateRouter = createTRPCRouter({
    generateIcon: protectedProcedure
        .input(z.object({
            prompt: z.string(),
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


        const base64EnCodedImage = await generateIcon(input.prompt);

        const icon = await ctx.prisma.icon.create({
            data: {
                prompt: input.prompt,
                userId: ctx.session.user.id,
            },
        });

        await s3.putObject({
            Bucket: env.AWS_BUCKET_NAME,
            Body: Buffer.from(base64EnCodedImage!, 'base64'),
            Key: icon.id,
            ContentEncoding: 'base64',
            ContentType: 'image/png',
        }).promise();



        return {
            imageUrl: `https://${env.AWS_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com/${icon.id}`,
        }
    })
});
