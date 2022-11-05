export function getRelativeMousePosition(elem: HTMLDivElement, e: MouseEvent) {
    const rect = elem.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
    };
}
