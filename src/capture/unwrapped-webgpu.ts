/* eslint-disable @typescript-eslint/ban-types */

type AnyFunc = (...args: any[]) => any;
type FuncsByName = Record<string, AnyFunc>;
const origFnsByClass = new Map<Function, FuncsByName>();

const isPromise = (p: any) => typeof p === 'object' && typeof p.then === 'function';

const mapClassToCreationFunctionNames = new Map<Function, Set<string>>();
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let getUnwrappedDevice = (_: GPUDevice): GPUDevice | undefined => undefined;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let setUnwrappedDevice = (wrapped: GPUDevice, unwrapped: GPUDevice) => { };

if (typeof GPUDevice !== 'undefined') {
    if (!GPUDevice.prototype.createBuffer.toString().includes('native')) {
        throw new Error('This must run before the context is wrapped!');
    }

    const webGPUClasses: Function[] = [
        HTMLCanvasElement,
        GPU,
        GPUAdapter,
        GPUBuffer,
        GPUCommandEncoder,
        GPUCanvasContext,
        GPUDevice,
        GPUQuerySet,
        GPUQueue,
        GPURenderPassEncoder,
        GPURenderPipeline,
        GPUComputePipeline,
        GPUComputePassEncoder,
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
        origFnsByClass.set(Class, origFns);
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

    classToCreationFunctionNames.forEach(pair => mapClassToCreationFunctionNames.set(...pair));

    const unwrappedDevices = new WeakMap<GPUDevice, GPUDevice>();
    getUnwrappedDevice = (wrapped: GPUDevice) => unwrappedDevices.get(wrapped);
    setUnwrappedDevice = (wrapped: GPUDevice, unwrapped: GPUDevice) => unwrappedDevices.set(wrapped, unwrapped);
}

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

    const Class = Object.getPrototypeOf(result).constructor;
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

    // Special case for device.queue
    if (result.queue && result.queue instanceof GPUQueue) {
        addOriginalFunctionsToResult(result.queue);
    }

    return result;
}

function callUnwrappedGPUFn(Class: Function, obj: any, fnName: string, ...args: any[]) {
    const origFns = origFnsByClass.get(Class)!;
    const origFn = origFns[fnName];
    const result = origFn.call(obj, ...args);
    if (isPromise(result)) {
        return result.then(addOriginalFunctionsToResult);
    }
    return addOriginalFunctionsToResult(result);
}

export function requestUnwrappedAdapter(options?: GPURequestAdapterOptions) {
    return callUnwrappedGPUFn(GPU, navigator.gpu, 'requestAdapter', options);
}

export function getUnwrappedGPUCanvasContext(canvas: HTMLCanvasElement, ...args: any[]) {
    return callUnwrappedGPUFn(HTMLCanvasElement, canvas, 'getContext', 'webgpu', ...args);
}

export function getUnwrappedGPUDeviceFromWrapped(wrapped: GPUDevice): GPUDevice {
    const unwrappedDevice = getUnwrappedDevice(wrapped);
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
    setUnwrappedDevice(wrapped, obj as GPUDevice);

    return obj as GPUDevice;
}
