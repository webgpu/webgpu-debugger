export function classNames(...classes: (Record<string, boolean> | string)[]): string {
    const names = [];
    for (const cl of classes) {
        if (typeof cl === 'string') {
            names.push(cl);
        } else {
            names.push(
                ...Object.entries(cl)
                    .filter(([, bool]) => bool)
                    .map(([className]) => className)
            );
        }
    }
    return names.join(' ');
}
