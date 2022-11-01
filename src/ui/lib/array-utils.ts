export function arrayRemoveElementByValue<Type>(array: Type[], value: Type) {
    const ndx = array.indexOf(value);
    if (ndx >= 0) {
        array.splice(ndx, 1);
    }
}

export function arrayCopyWithoutValue<Type>(array: Type[], value: Type) {
    return array.filter(v => v !== value);
}

function* range(n: number) {
    for (let i = 0; i < n; i++) {
        yield i;
    }
}

const s_ranges: number[][] = [];

export function getRange(n: number) {
    if (!s_ranges[n]) {
        s_ranges[n] = new Array(n).fill(0).map((_, i) => i);
    }
    return s_ranges[n];
}
