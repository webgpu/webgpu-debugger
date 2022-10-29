/* eslint-disable @typescript-eslint/ban-types */

if (!GPUDevice.prototype.createBuffer.toString().includes('native')) {
    throw new Error('This must run before the context is wrapped!');
}

type AnyFunc = (...args: any[]) => any;
type FuncsByName = Record<string, AnyFunc>;

const origFnsByClass = new Map<any, FuncsByName>();

const webGPUClasses: Function[] = [
    GPUAdapter,
    GPUBuffer,
    GPUCommandEncoder,
    GPUCanvasContext,
    GPUDevice,
    GPUQuerySet,
    GPUQueue,
    GPURenderPassEncoder,
    GPURenderPipeline,
    GPUTexture,
];

for (const Class of webGPUClasses) {
    const origFns: FuncsByName = {};
    const proto = Class.prototype;
    for (const name in proto) {
        const props = Object.getOwnPropertyDescriptor(proto, name);
        if (!props?.writable || typeof proto[name] !== 'function') {
            continue;
        }
        origFns[name] = proto[name];
    }
}

type ClassFnNamesA = [Function, string[]];
type ClassFnNames = [Function, Set<string>];

const cfn: ClassFnNamesA[] = [
    [GPU, ['requestAdapter']],
    [GPUAdapter, ['requestDevice']],
    [
        GPUDevice,
        [
            'createBuffer',
            'createTexture',
            'createSampler',
            'importExternalTexture',
            'createBindGroupLayout',
            'createPipelineLayout',
            'createBindGroup',
            'createShaderModule',
            'createComputePipeline',
            'createRenderPipeline',
            'createComputePipelineAsync',
            'createRenderPipelineAsync',
            'createCommandEncoder',
            'createRenderBundleEncoder',
            'createQuerySet',
        ],
    ],
    [GPUCommandEncoder, ['beginRenderPass', 'beginComputePass', 'finish']],
    [GPUCanvasContext, ['getCurrentTexture']],
    [GPUTexture, ['createView']],
];

const classToCreationFunctionNames: ClassFnNames[] = (() =>
    cfn.map(([Class, names]) => [Class, new Set<string>(names)]))();

const mapClassToCreationFunctionNames = new Map<Function, Set<string>>(classToCreationFunctionNames);

const isPromise = (p: any) => typeof p === 'object' && typeof p.then === 'function';

/**
 * The prototype to this object may have been altered so we
 * put properties on the object itself with the original functions.
 *
 * @param result The result of a function call
 * @returns result with original methods added as properties
 */
function addOriginalFunctionsToResult(result: any): any {
    if (typeof result !== 'object') {
        return result;
    }

    const Class = result.prototype.constructor;
    const origFns = origFnsByClass.get(Class);
    if (!origFns) {
        return result;
    }

    const createFns = mapClassToCreationFunctionNames.get(Class);

    for (const [fnName, origFn] of Object.entries(origFns)) {
        if (createFns && createFns.has(fnName)) {
            result[fnName] = function (...args: any[]) {
                const result = origFn.call(this, ...args);
                if (isPromise(result)) {
                    return result.then(addOriginalFunctionsToResult);
                }
                return addOriginalFunctionsToResult(result);
            };
        } else {
            result[fnName] = origFn;
        }
    }

    return result;
}

const unwrappedDevices = new WeakMap<GPUDevice, GPUDevice>();

export function getNonWrappedGPUDeviceForWrapped(wrapped: GPUDevice): GPUDevice {
    const unwrappedDevice = unwrappedDevices.get(wrapped);
    if (unwrappedDevice) {
        return unwrappedDevice;
    }

    const wrappedT = wrapped as Record<string, any>;
    const origFns = origFnsByClass.get(GPUDevice)!;
    const obj: Record<string, any> = {};
    for (const name in wrappedT) {
        const props = Object.getOwnPropertyDescriptor(wrappedT, name);
        if (!props?.writable || typeof wrappedT[name] !== 'function') {
            obj[name] = wrappedT[name];
        } else {
            const origFn = origFns[name];
            obj[name] = function (...args: any[]) {
                const result = origFn.call(this, ...args);
                if (isPromise(result)) {
                    return result.then(addOriginalFunctionsToResult);
                }
                return addOriginalFunctionsToResult(result);
            };
        }
    }

    return obj as GPUDevice;
}
