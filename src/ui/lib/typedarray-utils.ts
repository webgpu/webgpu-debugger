// TODO: fix better?
export const isTypedArray = (arr: any) =>
    arr && typeof arr.length === 'number' && arr.buffer instanceof ArrayBuffer && typeof arr.byteLength === 'number';
