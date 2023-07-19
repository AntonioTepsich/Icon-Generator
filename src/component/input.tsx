export function Input(props: React.ComponentPropsWithoutRef<"input"> ) {
    return <input {...props} type="text" className="border border-gray-400 rounded px-4 py-2  dark:text-gray-800" />;
}