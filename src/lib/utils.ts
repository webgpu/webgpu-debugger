const valueOr1 = (v?: number) => (v === undefined ? 1 : v);

// TODO: fix
const isSequence = (v: any) => Symbol.iterator in Object(v);

// This differs from a GPUExtent3DDict in that
// it requires all 3 values which makes it less of a PITA to use
export type GPUExtent3DDictFull = {
    width: number;
    height: number;
    depthOrArrayLayers: number;
};

function dimensionsFromGPUExtent3D(extent: GPUExtent3D): number[] {
    if (isSequence(extent)) {
        const iter = extent as Array<number>;
        return [1, 1, 1].map((_, ndx) => valueOr1(iter[ndx]));
    } else {
        const dict = extent as GPUExtent3DDict;
        return [dict.width, dict.height, dict.depthOrArrayLayers].map(valueOr1);
    }
}

export function gpuExtent3DDictFullFromGPUExtent3D(extent: GPUExtent3D): GPUExtent3DDictFull {
    const [width, height, depthOrArrayLayers] = dimensionsFromGPUExtent3D(extent);
    return { width, height, depthOrArrayLayers };
}
