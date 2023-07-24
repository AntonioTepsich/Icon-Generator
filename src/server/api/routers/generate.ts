import { TRPCError } from "@trpc/server";
import { string, z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { Configuration, OpenAIApi } from "openai"
import { env } from "~/env.mjs"
import { b64Image } from "~/data/b64Image";
import AWS from "aws-sdk";

const s3 = new AWS.S3({
    accessKeyId: env.ACCESS_KEY_ID_AWS,
    secretAccessKey: env.SECRET_ACCESS_KEY_AWS,
    region: env.REGION_AWS,
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
            color: z.string(),
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

        const finalPrompt = `a modern icon in ${input.color} of ${input.prompt}, 3d rendered, metalic material, shiny minimalistic`;

        const base64EnCodedImage = await generateIcon(finalPrompt);

        const icon = await ctx.prisma.icon.create({
            data: {
                prompt: input.prompt,
                userId: ctx.session.user.id,
            },
        });

        await s3.putObject({
            Bucket: env.BUCKET_NAME_AWS,
            Body: Buffer.from(base64EnCodedImage!, 'base64'),
            Key: icon.id,
            ContentEncoding: 'base64',
            ContentType: 'image/png',
        }).promise();



        return {
            imageUrl: `https://${env.BUCKET_NAME_AWS}.s3.${env.REGION_AWS}.amazonaws.com/${icon.id}`,
        }
    })
});
