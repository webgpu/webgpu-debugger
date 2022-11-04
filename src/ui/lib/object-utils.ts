const s_baseObjectProto = Object.getPrototypeOf({});

export const isBaseObject = (obj: any) => {
    const proto = Object.getPrototypeOf(obj);
    return proto === s_baseObjectProto;
};

// 'device' is only on GPUAdaptorInfo and GPUCanvasConfiguration. Can special case those if we need to
// 'replay' is part of the ReplayXXX objects
// 'webgpuObject' is part of the ReplayXXX objects
const s_excludedProperties = new Set([
    'bufferSerial',
    'device',
    'deviceSerial',
    'layoutSerial',
    'moduleSerial',
    'replay',
    'textureSerial',
    'webgpuObject',
    'swapChainId',
]);

export const isExcludedPropertyName = (name: string) => s_excludedProperties.has(name);
