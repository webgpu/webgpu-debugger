const valueOr1 = (v?: number) => (v === undefined ? 1 : v);

// TODO: fix
const isSequence = (v: any) => Symbol.iterator in Object(v);

function dimensionsFromGPUExtent3D(extent: GPUExtent3D): number[] {
    if (isSequence(extent)) {
        const iter = extent as Array<number>;
        return [1, 1, 1].map((_, ndx) => valueOr1(iter[ndx]));
    } else {
        const dict = extent as GPUExtent3DDict;
        return [dict.width, dict.height, dict.depthOrArrayLayers].map(valueOr1);
    }
}

export function gpuExtent3DDictFromGPUExtent3D(extent: GPUExtent3D): GPUExtent3DDict {
    const [width, height, depthOrArrayLayers] = dimensionsFromGPUExtent3D(extent);
    return { width, height, depthOrArrayLayers };
}
