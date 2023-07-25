import { type Icon } from "@prisma/client";
import { type NextPage } from "next";
import Head from "next/head";
import { env } from "~/env.mjs";
import { api } from "~/utils/api";
import Image from "next/image";


const CollectionPage: NextPage = () => {

    const icons = api.icons.getIcons.useQuery();

    return (
        <>
            <Head>
                <title>Your Icons</title>
                <meta name="description" content="Your icons" />
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <main className="container px-8 mx-auto mt-24 flex min-h-screen flex-col gap-4">
                <h1 className="text-4xl">Your Icons</h1>
                <ul className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6">
                    {icons.data?.map((icon : Icon) => (
                        <li key={icon.id}>
                            <Image className="w-full" width="100" height="100" alt={icon.prompt ?? "an image of an icon"} 
                                src={`https://icon-generator-t3.s3.sa-east-1.amazonaws.com/${icon.id}`} />
                        </li>
                    ))}
                </ul>
            </main>
        </>
    );
};

export default CollectionPage;
