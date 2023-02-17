type BitNameValue = {
    bitName: string;
    bitValue: number;
};

const bitmaskToString = (v: number, bitNameValues: BitNameValue[]) => {
    const bitNames = [];
    for (const { bitName, bitValue } of bitNameValues) {
        if (v & bitValue) {
            bitNames.push(bitName);
        }
    }
    return bitNames.join(' | ');
};

// prettier-ignore
const gpuBufferUsage = [
    { bitName: 'MAP_READ',       bitValue: 0x0001, },
    { bitName: 'MAP_WRITE',      bitValue: 0x0002, },
    { bitName: 'COPY_SRC',       bitValue: 0x0004, },
    { bitName: 'COPY_DST',       bitValue: 0x0008, },
    { bitName: 'INDEX',          bitValue: 0x0010, },
    { bitName: 'VERTEX',         bitValue: 0x0020, },
    { bitName: 'UNIFORM',        bitValue: 0x0040, },
    { bitName: 'STORAGE',        bitValue: 0x0080, },
    { bitName: 'INDIRECT',       bitValue: 0x0100, },
    { bitName: 'QUERY_RESOLVE',  bitValue: 0x0200, },
];

export const gpuBufferUsageToString = (v: number) => bitmaskToString(v, gpuBufferUsage);

// prettier-ignore
const gpuTextureUsage = [
    { bitName: 'COPY_SRC',           bitValue: 0x01, },
    { bitName: 'COPY_DST',           bitValue: 0x02, },
    { bitName: 'TEXTURE_BINDING',    bitValue: 0x04, },
    { bitName: 'STORAGE_BINDING',    bitValue: 0x08, },
    { bitName: 'RENDER_ATTACHMENT',  bitValue: 0x10, },
];

export const gpuTextureUsageToString = (v: number) => bitmaskToString(v, gpuTextureUsage);

export const gpuExtent3DToShortString = (s: GPUExtent3D) => {
    const sd = s as GPUExtent3DDict;
    return Array.isArray(s) ? s.toString : `${sd.width || 1},${sd.height || 1},${sd.depthOrArrayLayers || 1}`;
};
