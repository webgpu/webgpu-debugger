export function arrayRemoveElementByValue<Type>(array: Type[], value: Type) {
    const ndx = array.indexOf(value);
    if (ndx >= 0) {
        array.splice(ndx, 1);
    }
}

export function arrayCopyWithoutValue<Type>(array: Type[], value: Type) {
    return array.filter(v => v !== value);
}
