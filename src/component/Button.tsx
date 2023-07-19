export function Button(props: React.ComponentPropsWithoutRef<"button">){
    return (
        <button {...props} className="bg-blue-400 hover:bg-blue-500 px-4 py-2 rounded">
            {props.children}
        </button>
    )
} 
