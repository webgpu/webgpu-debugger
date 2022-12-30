/* eslint-disable @typescript-eslint/ban-types */
import { gpuExtent3DDictFullFromGPUExtent3D, GPUExtent3DDictFull } from '../lib/utils';

type TypedArray =
    | Int8Array
    | Uint8Array
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | Float32Array
    | Float64Array;

interface CaptureStateBase<GPUType> {
    webgpuObject: GPUType | null;
    traceSerial: number;
    label?: string;
}

interface CaptureStateSync<GPUType, TraceType> extends CaptureStateBase<GPUType> {
    serialize: () => TraceType;
}

interface CaptureStateAsync<GPUType, TraceType> extends CaptureStateBase<GPUType> {
    serializeAsync: () => Promise<TraceType>;
}

class ObjectRegistry<GPUType extends Object, CaptureState extends CaptureStateBase<GPUType>> {
    iterating: boolean;
    currentTraceSerial: number;
    dataMap: WeakMap<GPUType, CaptureState>;
    objects: WeakRef<GPUType>[];

    constructor() {
        this.dataMap = new WeakMap();
        this.objects = [];
        this.currentTraceSerial = 0;
        this.iterating = false;
    }

    add(obj: GPUType, data: CaptureState) {
        if (this.iterating) {
            throw new Error('Mutating Registry while iterating it.');
        }

        this.dataMap.set(obj, data);
        this.objects.push(new WeakRef(obj));
        data.webgpuObject = obj;
        data.traceSerial = this.currentTraceSerial;
        this.currentTraceSerial++;
    }

    has(obj: GPUType) {
        return this.dataMap.has(obj);
    }

    get(obj: GPUType) {
        return this.dataMap.get(obj);
    }

    prune() {
        if (this.iterating) {
            throw new Error('Mutating Registry while iterating it.');
        }

        this.objects = this.objects.filter(ref => ref.deref() !== undefined);
    }

    [Symbol.iterator](this: ObjectRegistry<GPUType, CaptureState>) {
        let i = 0;
        this.iterating = true;

        return {
            next: () => {
                while (i < this.objects.length) {
                    const obj = this.objects[i++].deref();
                    if (obj === undefined) {
                        continue;
                    }
                    return { value: this.get(obj)!, done: false };
                }
                this.iterating = false;
                return { done: true, value: null as unknown as CaptureState }; // TODO: Fix once I understand typescript
            },
        };
    }
}

type Proto = Record<string, Function>;
type ClassFuncs = { Class: Function; proto: Proto; wrappers: Proto };
type RequestAdapterFn = (options?: GPURequestAdapterOptions) => Promise<GPUAdapter | null>;

export interface TraceObject {
    label?: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface TraceAdapter extends TraceObject {}

export interface TraceBindGroupEntry {
    binding: number;
    textureViewSerial?: number;
    samplerSerial?: number;
    bufferSerial?: number;
    offset?: number;
    size?: number;
}

export interface TraceBindGroup extends TraceObject {
    deviceSerial: number;
    layoutSerial: number;
    entries: TraceBindGroupEntry[];
}

export interface TraceBindGroupBufferEntry {
    type: string;
    hasDynamicOffset: boolean;
    minBindingSize: number;
}

export interface TraceBindGroupSamplerEntry {
    type: string;
}

export interface TraceBindGroupTextureEntry {
    sampleType: string;
    viewDimension: string;
    multisampled: boolean;
}

export interface TraceBindGroupStorageTextureEntry {
    access: string;
    format: string;
    viewDimension: string;
}

export type TraceBindGroupExternalTextureEntry = {};

export interface TraceExplicitBindGroupEntry {
    binding: number;
    visibility: number;
    buffer?: TraceBindGroupBufferEntry;
    sampler?: TraceBindGroupSamplerEntry;
    texture?: TraceBindGroupTextureEntry;
    storageTexture?: TraceBindGroupStorageTextureEntry;
    externalTexture?: TraceBindGroupExternalTextureEntry;
}

export interface TraceExplicitBindGroupLayout extends TraceObject {
    deviceSerial: number;
    entries: TraceExplicitBindGroupEntry[];
}

export interface TraceImplicitBindGroupLayout extends TraceObject {
    deviceSerial: number;
    renderPipelineSerial: number;
    groupIndex: number;
}

export type TraceBindGroupLayout = TraceImplicitBindGroupLayout | TraceExplicitBindGroupLayout;

export interface TraceBuffer extends TraceObject {
    deviceSerial: number;
    usage: number;
    size: number;
    state: string;
    initialData?: {
        size: number;
        serial: number;
    };
}

export interface TraceCommandBufferCommandCopyTextureToTexture {
    name: 'copyTextureToTexture';
    args: {
        source: TraceImageCopyTexture;
        destination: TraceImageCopyTexture;
        copySize: GPUExtent3D;
    };
}

export interface TraceCommandBufferCommandCopyBufferToTexture {
    name: 'copyBufferToTexture';
    args: {
        source: TraceImageCopyBuffer;
        destination: TraceImageCopyTexture;
        copySize: GPUExtent3D;
    };
}

export interface TraceCommandBufferCommandPopDebugGroup {
    name: 'popDebugGroup';
}

export interface TraceCommandBufferCommandPushDebugGroup {
    name: 'pushDebugGroup';
    args: {
        groupLabel: string;
    };
}

export interface TraceCommandBuffer extends TraceObject {
    commands: TraceCommandBufferCommand[];
    deviceSerial: number;
}

export interface TraceRenderPassColorAttachment {
    viewSerial: number;
    resolveTargetSerial?: number;
    clearValue: GPUColorDict;
    loadOp: GPULoadOp;
    storeOp: GPUStoreOp;
}

export interface TraceRenderPassTimestampWrite {
    querySetSerial: number;
    queryIndex: number;
    location: GPURenderPassTimestampLocation;
}

export interface TraceRenderPassDepthStencilAttachment {
    viewSerial: number;
    depthClearValue: number;
    depthLoadOp?: GPULoadOp;
    depthStoreOp?: GPUStoreOp;
    depthReadOnly: boolean;
    stencilClearValue: number;
    stencilLoadOp?: GPULoadOp;
    stencilStoreOp?: GPUStoreOp;
    stencilReadOnly: boolean;
}

export interface TraceCommandBeginRenderPassArgs {
    colorAttachments: TraceRenderPassColorAttachment[];
    timestampWrites: TraceRenderPassTimestampWrite[];
    occlusionQuerySetSerial?: number;
    maxDrawCount: number;
    depthStencilAttachment?: TraceRenderPassDepthStencilAttachment;
}

export interface TraceCommandBufferCommandBeginRenderPass {
    name: 'beginRenderPass';
    args: TraceCommandBeginRenderPassArgs;
}

export interface TraceCommandBufferCommandDraw {
    name: 'draw';
    args: {
        vertexCount: number;
        instanceCount: number;
        firstVertex: number;
        firstInstance: number;
    };
}

export interface TraceCommandBufferCommandDrawIndexed {
    name: 'drawIndexed';
    args: {
        indexCount: number;
        instanceCount: number;
        firstIndex: number;
        baseVertex: number;
        firstInstance: number;
    };
}

export interface TraceCommandBufferCommandSetBindGroup {
    name: 'setBindGroup';
    args: {
        index: number;
        bindGroupSerial: number;
        dynamicOffsets?: GPUBufferDynamicOffset[];
    };
}

export interface TraceCommandBufferCommandSetIndexBuffer {
    name: 'setIndexBuffer';
    args: {
        bufferSerial: number;
        indexFormat: GPUIndexFormat;
        offset: number;
        size: number;
    };
}

export interface TraceCommandBufferCommandSetPipeline {
    name: 'setPipeline';
    args: {
        pipelineSerial: number;
    };
}

export interface TraceCommandBufferCommandSetVertexBuffer {
    name: 'setVertexBuffer';
    args: {
        slot: number;
        bufferSerial: number;
        offset: number;
        size: number;
    };
}

export interface TraceCommandBufferCommandSetScissorRect {
    name: 'setScissorRect';
    args: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

export interface TraceCommandBufferCommandSetViewport {
    name: 'setViewport';
    args: {
        x: number;
        y: number;
        width: number;
        height: number;
        minDepth: number;
        maxDepth: number;
    };
}

export interface TraceCommandBufferCommandEndPass {
    name: 'endPass';
}

export type TraceCommandBufferCommand =
    | TraceCommandBufferCommandCopyTextureToTexture
    | TraceCommandBufferCommandCopyBufferToTexture
    | TraceCommandBufferCommandPopDebugGroup
    | TraceCommandBufferCommandPushDebugGroup
    | TraceCommandBufferCommandBeginRenderPass
    | TraceCommandBufferCommandDraw
    | TraceCommandBufferCommandDrawIndexed
    | TraceCommandBufferCommandSetBindGroup
    | TraceCommandBufferCommandSetIndexBuffer
    | TraceCommandBufferCommandSetPipeline
    | TraceCommandBufferCommandSetVertexBuffer
    | TraceCommandBufferCommandSetScissorRect
    | TraceCommandBufferCommandSetViewport
    | TraceCommandBufferCommandEndPass;

export interface TraceDevice extends TraceObject {
    adapterSerial: number;
}

export interface TracePipelineLayout extends TraceObject {
    deviceSerial: number;
    bindGroupLayoutsSerial: number[];
}

export interface TraceQuerySet extends TraceObject {
    deviceSerial: number;
    type: GPUQueryType;
    count: number;
    state: string;
}

export interface TraceQueue extends TraceObject {
    deviceSerial: number;
}

export interface TraceSamplerState extends TraceObject {
    addressModeU: GPUAddressMode;
    addressModeV: GPUAddressMode;
    addressModeW: GPUAddressMode;
    magFilter: GPUFilterMode;
    minFilter: GPUFilterMode;
    mipmapFilter: GPUMipmapFilterMode;
    lodMinClamp: number;
    lodMaxClamp: number;
    compare?: GPUCompareFunction;
    maxAnisotropy: number;
}

export interface TraceSampler extends TraceSamplerState {
    deviceSerial: number;
}

export interface TraceVertexState {
    moduleSerial: number;
    entryPoint: string;
    constants: Record<string, number>;
    buffers: GPUVertexBufferLayout[];
}

export interface TraceFragmentState {
    moduleSerial: number;
    entryPoint: string;
    constants: Record<string, number>;
    targets: GPUColorTargetState[];
}

export interface TraceRenderPipeline extends TraceObject {
    deviceSerial: number;
    layoutSerial?: number;
    layout?: string;
    vertex: TraceVertexState;
    primitive: GPUPrimitiveState;
    depthStencil?: GPUDepthStencilState;
    multisample: GPUMultisampleState;
    fragment?: TraceFragmentState;
}

export interface TraceShaderModule extends TraceObject {
    deviceSerial: number;
    code: string;
}

export interface TraceData {
    size: number;
    serial: number;
}
export interface TraceTextureInitialData {
    data: TraceData;
    mipLevel: number;
    bytesPerRow: number;
}

export interface TraceTexture extends TraceObject {
    deviceSerial: number;
    state: string;
    format: GPUTextureFormat;
    usage: GPUTextureUsageFlags;
    size: GPUExtent3DDictFull;
    dimension: GPUTextureDimension;
    sampleCount: number;
    mipLevelCount: number;
    viewFormats: GPUTextureFormat[];
    swapChainId?: string;
    initialData?: TraceTextureInitialData[];
}

export interface TraceTextureView extends TraceObject {
    textureSerial: number;
    format: GPUTextureFormat;
    dimension: GPUTextureViewDimension;
    aspect: GPUTextureAspect;
    baseMipLevel: number;
    mipLevelCount?: number;
    baseArrayLayer: number;
    arrayLayerCount?: number;
}

export interface TraceQueueCommandSubmit {
    name: 'queueSubmit';
    queueSerial: number;
    args: {
        commandBufferSerials: number[];
    };
}

export interface TraceQueueCommandWriteBuffer {
    name: 'queueWriteBuffer';
    queueSerial: number;
    args: {
        bufferSerial: number;
        bufferOffset: number;
        data: TraceData;
    };
}

export interface TraceImageCopyTexture {
    textureSerial: number;
    mipLevel: number;
    origin: GPUOrigin3D;
    aspect: GPUTextureAspect;
}

export interface TraceImageCopyBuffer {
    bufferSerial: number;
    offset: number;
    bytesPerRow?: number;
    rowsPerImage?: number;
}

export interface TraceQueueCommandWriteTexture {
    name: 'queueWriteTexture';
    queueSerial: number;
    args: {
        destination: TraceImageCopyTexture;
        data: TraceData;
        dataLayout: GPUImageDataLayout;
        size: GPUExtent3D;
    };
}

export interface TraceQueueCommandPresent {
    name: 'present';
    args: {
        canvasContextSerial: number;
        textureSerial: number;
    };
}

export interface TraceQueueCommandTextureDestroy {
    name: 'textureDestroy';
    textureSerial: number;
}

export interface TraceBufferUpdate {
    data: TraceData;
    offset: number;
    size: number;
}

export interface TraceQueueCommandBufferUpdateData {
    name: 'bufferUpdateData';
    bufferSerial: number;
    updates: TraceBufferUpdate[];
}

export interface TraceQueueCommandBufferUnmap {
    name: 'bufferUnmap';
    bufferSerial: number;
}

export type TraceQueueCommand =
    | TraceQueueCommandSubmit
    | TraceQueueCommandWriteBuffer
    | TraceQueueCommandWriteTexture
    | TraceQueueCommandPresent
    | TraceQueueCommandTextureDestroy
    | TraceQueueCommandBufferUpdateData
    | TraceQueueCommandBufferUnmap;

export interface Trace {
    objects: {
        adapters: Record<number, TraceAdapter>;
        bindGroups: Record<number, TraceBindGroup>;
        bindGroupLayouts: Record<number, TraceBindGroupLayout>;
        buffers: Record<number, TraceBuffer>;
        commandBuffers: Record<number, TraceCommandBuffer>;
        commandEncoders: Record<number, any>; // TODO: Add correct type
        canvasContexts: Record<number, any>; // TODO: Add correct type
        devices: Record<number, TraceDevice>;
        pipelineLayouts: Record<number, TracePipelineLayout>;
        querySets: Record<number, TraceQuerySet>;
        queues: Record<number, TraceQueue>;
        samplers: Record<number, TraceSampler>;
        renderPassEncoders: Record<number, any>; // TODO: Add correct type
        renderPipelines: Record<number, TraceRenderPipeline>;
        shaderModules: Record<number, TraceShaderModule>;
        textures: Record<number, TraceTexture>;
        textureViews: Record<number, TraceTextureView>;
    };
    commands: TraceQueueCommand[];
    data: Record<number, number[]>;
}

export class Spector2 {
    tracing = false;
    dataSerial = 0;
    inReentrantWebGPUOperations = false;

    adapters = new ObjectRegistry<GPUAdapter, AdapterState>();
    bindGroups = new ObjectRegistry<GPUBindGroup, BindGroupState>();
    bindGroupLayouts = new ObjectRegistry<GPUBindGroupLayout, BindGroupLayoutState>();
    buffers = new ObjectRegistry<GPUBuffer, BufferState>();
    commandBuffers = new ObjectRegistry<GPUCommandBuffer, CommandBufferState>();
    commandEncoders = new ObjectRegistry<GPUCommandEncoder, CommandEncoderState>();
    canvasContexts = new ObjectRegistry<GPUCanvasContext, CanvasContextState>();
    devices = new ObjectRegistry<GPUDevice, DeviceState>();
    pipelineLayouts = new ObjectRegistry<GPUPipelineLayout, PipelineLayoutState>();
    querySets = new ObjectRegistry<GPUQuerySet, QuerySetState>();
    queues = new ObjectRegistry<GPUQueue, QueueState>();
    renderPassEncoders = new ObjectRegistry<GPURenderPassEncoder, RenderPassEncoderState>();
    renderPipelines = new ObjectRegistry<GPURenderPipeline, RenderPipelineState>();
    samplers = new ObjectRegistry<GPUSampler, SamplerState>();
    shaderModules = new ObjectRegistry<GPUShaderModule, ShaderModuleState>();
    textures = new ObjectRegistry<GPUTexture, TextureState>();
    textureViews = new ObjectRegistry<GPUTextureView, TextureViewState>();

    adapterProto: Proto;
    bufferProto: Proto;
    commandEncoderProto: Proto;
    canvasContextProto: Proto;
    deviceProto: Proto;
    querySetProto: Proto;
    queueProto: Proto;
    renderPassEncoderProto: Proto;
    renderPipelineProto: Proto;
    textureProto: Proto;

    canvasGetContext: Function;
    gpuRequestAdapter: RequestAdapterFn;

    trace?: Trace;
    pendingTraceOperations: Promise<void>[] = [];

    wrappers: {
        classes: ClassFuncs[];
        getContextWrapper: Function;
        requestAdaptorWrapper: RequestAdapterFn;
    };

    constructor() {
        function replacePrototypeOf<GPUType extends Object, CaptureState extends CaptureStateBase<GPUType>>(
            c: Function,
            registry: ObjectRegistry<GPUType, CaptureState>
        ) {
            const originalProto: Record<string, Function> = {};

            for (const name in c.prototype) {
                const props = Object.getOwnPropertyDescriptor(c.prototype, name);
                if (!props?.writable || typeof c.prototype[name] !== 'function') {
                    continue;
                }
                const originalMethod: Function = c.prototype[name];
                originalProto[name] = originalMethod;
                c.prototype[name] = function (...args: any[]) {
                    if (spector2.inReentrantWebGPUOperations) {
                        return originalMethod.apply(this, args);
                    }

                    const self = registry.get(this)!;
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    const fn: Function = self[name] as Function;
                    if (!fn) {
                        console.assert(false, `Doesn't have "${name}"`);
                    }
                    return fn.call(self, ...args);
                };
            }
            return originalProto;
        }

        this.adapterProto = replacePrototypeOf(GPUAdapter, this.adapters);
        // GPUBindGroup doesn't have methods except the label setter?
        // GPUBindGroupLayout doesn't have methods except the label setter?
        this.bufferProto = replacePrototypeOf(GPUBuffer, this.buffers);
        // GPUCommandBuffer doesn't have methods except the label setter?
        this.commandEncoderProto = replacePrototypeOf(GPUCommandEncoder, this.commandEncoders);
        this.canvasContextProto = replacePrototypeOf(GPUCanvasContext, this.canvasContexts);
        this.deviceProto = replacePrototypeOf(GPUDevice, this.devices);
        // GPUPipelineLayout doesn't have methods except the label setter?
        this.querySetProto = replacePrototypeOf(GPUQuerySet, this.querySets);
        this.queueProto = replacePrototypeOf(GPUQueue, this.queues);
        this.renderPassEncoderProto = replacePrototypeOf(GPURenderPassEncoder, this.renderPassEncoders);
        this.renderPipelineProto = replacePrototypeOf(GPURenderPipeline, this.renderPipelines);
        // GPUSampler doesn't have methods except the label setter?
        // TODO shader module prototype
        this.textureProto = replacePrototypeOf(GPUTexture, this.textures);
        // GPUTextureView doesn't have methods except the label setter?

        // Special case replacements
        this.canvasGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...args) {
            const context = spector2.canvasGetContext.call(this, type, ...args);
            if (type === 'webgpu') {
                spector2.registerObjectIn('canvasContexts', context, new CanvasContextState(this));
            }
            return context;
        };
        this.gpuRequestAdapter = GPU.prototype.requestAdapter;
        GPU.prototype.requestAdapter = async function (options, ...args) {
            const adapter = await spector2.gpuRequestAdapter.call(this, options, ...args);
            spector2.registerObjectIn('adapters', adapter!, new AdapterState(options)); // TODO deep copy options
            return adapter;
        };

        // Save everything we wrapped for re-wrapping
        this.wrappers = {
            classes: [
                { Class: GPUAdapter, proto: this.adapterProto, wrappers: {} },
                { Class: GPUBuffer, proto: this.bufferProto, wrappers: {} },
                { Class: GPUCommandEncoder, proto: this.commandEncoderProto, wrappers: {} },
                { Class: GPUCanvasContext, proto: this.canvasContextProto, wrappers: {} },
                { Class: GPUDevice, proto: this.deviceProto, wrappers: {} },
                { Class: GPUQuerySet, proto: this.querySetProto, wrappers: {} },
                { Class: GPUQueue, proto: this.queueProto, wrappers: {} },
                { Class: GPURenderPassEncoder, proto: this.renderPassEncoderProto, wrappers: {} },
                { Class: GPURenderPipeline, proto: this.renderPipelineProto, wrappers: {} },
                { Class: GPUTexture, proto: this.textureProto, wrappers: {} },
            ],
            getContextWrapper: HTMLCanvasElement.prototype.getContext,
            requestAdaptorWrapper: GPU.prototype.requestAdapter,
        };

        const saveEntryPoints = ({ Class, proto, wrappers }: ClassFuncs) => {
            for (const name in proto) {
                wrappers[name] = Class.prototype[name];
            }
        };

        this.wrappers.classes.forEach(saveEntryPoints);
    }

    wrapEntryPoints() {
        const setEntryPointsToWrappers = ({ Class, proto, wrappers }: ClassFuncs) => {
            for (const name in proto) {
                Class.prototype[name] = wrappers[name];
            }
        };

        this.wrappers.classes.forEach(setEntryPointsToWrappers);

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        HTMLCanvasElement.prototype.getContext = this.wrappers.getContextWrapper;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        GPU.prototype.requestAdaptor = this.wrappers.requestAdaptorWrapper;
    }

    // For now we don't support all entrypoints, which breaks the replay, here's a method to put regular entrypoints back.
    revertEntryPoints() {
        const revertEntryPoints = ({ Class, proto }: ClassFuncs) => {
            for (const name in proto) {
                Class.prototype[name] = proto[name];
            }
        };

        this.wrappers.classes.forEach(revertEntryPoints);

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        HTMLCanvasElement.prototype.getContext = this.canvasGetContext;
        GPU.prototype.requestAdapter = this.gpuRequestAdapter;
    }

    /**
     * Do not call this function outside of this file.
     * If you want to use webgpu without your calls being inspected call one or more
     * of
     *
     * * requestUnwrappedAdapter (instead of navigator.gpu.requestAdapter)
     * * getUnwrappedGPUCanvasContext (instead of someCanvas.getContext('webgpu'))
     * * getUnwrappedGPUDeviceFromWrapped (if you have a wrapped device)
     *
     * Note: The device attached to `ReplayDevice` is already unwrapped and is
     * safe to call.
     *
     * @param f
     */
    doWebGPUOp(f: () => void) {
        this.inReentrantWebGPUOperations = true;
        f();
        this.inReentrantWebGPUOperations = false;
    }

    // TODO add support for prune all.
    // TODO make something to trace easily instead of start stop trace.
    startTracing() {
        function serializeAllObjects<
            GPUType extends Object,
            CaptureState extends CaptureStateSync<GPUType, TraceType>,
            TraceType extends TraceObject
        >(registry: ObjectRegistry<GPUType, CaptureState>) {
            const result: Record<string, TraceType> = {};
            for (const obj of registry) {
                const serializedObj = obj.serialize();
                if (obj.label) {
                    serializedObj.label = obj.label;
                }
                result[obj.traceSerial] = serializedObj;
            }
            return result;
        }

        // Yuck
        function serializeAsyncAllObjects<
            GPUType extends Object,
            CaptureState extends CaptureStateAsync<GPUType, TraceType>,
            TraceType extends TraceObject
        >(registry: ObjectRegistry<GPUType, CaptureState>, pendingPromises: Promise<void>[]) {
            const result: Record<string, TraceType> = {};
            // TODO have some context where objects can ask for a device?
            for (const obj of registry) {
                pendingPromises.push(
                    obj.serializeAsync().then(serializedObj => {
                        if (obj.label) {
                            serializedObj.label = obj.label;
                        }
                        result[obj.traceSerial] = serializedObj;
                    })
                );
            }
            return result;
        }

        this.tracing = true;
        this.pendingTraceOperations = [];

        this.trace = {
            objects: {
                adapters: serializeAllObjects(this.adapters),
                bindGroups: serializeAllObjects(this.bindGroups),
                bindGroupLayouts: serializeAllObjects(this.bindGroupLayouts),
                buffers: serializeAsyncAllObjects(this.buffers, this.pendingTraceOperations),
                commandBuffers: serializeAllObjects(this.commandBuffers),
                commandEncoders: {},
                canvasContexts: {},
                devices: serializeAllObjects(this.devices),
                pipelineLayouts: serializeAllObjects(this.pipelineLayouts),
                querySets: serializeAllObjects(this.querySets),
                queues: serializeAllObjects(this.queues),
                samplers: serializeAllObjects(this.samplers),
                renderPassEncoders: {},
                renderPipelines: serializeAllObjects(this.renderPipelines),
                shaderModules: serializeAllObjects(this.shaderModules),
                textures: serializeAsyncAllObjects(this.textures, this.pendingTraceOperations),
                textureViews: serializeAllObjects(this.textureViews),
            },
            commands: [],
            data: {},
        };
    }

    async endTracing() {
        // No more commands are recorded except presents
        this.tracing = false;

        // TODO deep copy what we currently have? We risk changing state with future operations.
        await Promise.all(this.pendingTraceOperations);

        return this.trace;
    }

    recordingTrace() {
        return this.tracing;
    }

    addPendingTraceOperation(promise: Promise<void>) {
        console.assert(this.tracing || this.pendingTraceOperations.length > 0);
        this.pendingTraceOperations.push(promise);
    }

    traceCommand(command: TraceQueueCommand) {
        console.assert(this.tracing || this.pendingTraceOperations.length > 0);
        this.trace!.commands.push(command);
    }

    traceData(buffer: ArrayBuffer, offset?: number, size?: number) {
        console.assert(this.tracing || this.pendingTraceOperations.length > 0);
        offset ??= 0;
        size ??= buffer.byteLength - offset;

        const byteArray = new Uint8Array(buffer, offset, size);
        // Worst serialization ever!
        this.trace!.data[this.dataSerial] = Array.from(byteArray);
        const dataRef = {
            size,
            serial: this.dataSerial,
        };
        this.dataSerial++;
        return dataRef;
    }

    registerObjectIn(typePlural: string, webgpuObject: GPUObjectBase | GPUAdapter, state: any) {
        // TODO: fixing these 2 lines to be typescript happy seems like a bunch of
        // work. You'd probably have to put both the first collections and the second
        // in some map/record of named collections

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this[typePlural].add(webgpuObject, state);
        if (this.tracing) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            this.trace.objects[typePlural][state.traceSerial] = state.serialize();
        }
    }

    async traceFrame() {
        this.startTracing();

        await new Promise<void>(resolve => {
            requestAnimationFrame(() => {
                setTimeout(() => {
                    resolve();
                }, 0);
            });
        });

        return await this.endTracing();
    }
}

const spector2 = new Spector2();
export { spector2 };

class BaseState<T> {
    webgpuObject: T | null;
    traceSerial: number;
    label?: string;

    constructor(desc?: GPUObjectDescriptorBase) {
        // TODO what about the setter for labels?
        if (desc && desc.label) {
            this.label = desc.label;
        }
        this.webgpuObject = null;
        this.traceSerial = -1;
    }
}

class AdapterState extends BaseState<GPUAdapter> {
    // TODO: do we need the adaptor options?
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(options: GPURequestAdapterOptions | undefined) {
        super({} as GPUObjectBase);
    }

    serialize() {
        return {};
    }

    async requestDevice(desc: GPUDeviceDescriptor) {
        const device = await spector2.adapterProto.requestDevice.call(this.webgpuObject, desc);
        spector2.registerObjectIn('devices', device, new DeviceState(this, desc ?? {}));
        spector2.registerObjectIn(
            'queues',
            device.queue,
            new QueueState(spector2.devices.get(device)!, {} /*TODO desc*/)
        );
        return device;
    }
}

interface BindGroupEntry {
    binding: number;
    textureView?: TextureViewState;
    sampler?: SamplerState;
    buffer?: BufferState;
    offset?: number;
    size?: number;
}

class BindGroupState extends BaseState<GPUBindGroup> {
    device: DeviceState;
    layout: BindGroupLayoutState;
    entries: BindGroupEntry[];

    constructor(device: DeviceState, desc: GPUBindGroupDescriptor) {
        super(desc);
        this.device = device;
        this.layout = spector2.bindGroupLayouts.get(desc.layout)!;

        this.entries = (desc.entries as GPUBindGroupEntry[]).map(e => {
            const entry: BindGroupEntry = { binding: e.binding };
            const textureViewState = spector2.textureViews.get(e.resource as GPUTextureView);
            if (textureViewState) {
                entry.textureView = textureViewState;
            } else {
                const samplerState = spector2.samplers.get(e.resource as GPUSampler);
                if (samplerState) {
                    entry.sampler = samplerState;
                } else {
                    const bufferBinding = e.resource as GPUBufferBinding;
                    if (bufferBinding.buffer !== undefined) {
                        const bufferState = spector2.buffers.get(bufferBinding.buffer)!;
                        entry.buffer = bufferState;
                        entry.offset = bufferBinding.offset ?? 0;
                        entry.size = bufferBinding.size ?? Math.max(0, bufferState.size - entry.offset);
                    } else {
                        console.assert(false, 'Unhandled binding type.');
                    }
                }
            }
            return entry;
        });
    }

    serialize(): TraceBindGroup {
        return {
            deviceSerial: this.device.traceSerial,
            layoutSerial: this.layout.traceSerial,
            entries: this.entries.map(e => {
                const entry: TraceBindGroupEntry = { binding: e.binding };
                if (e.textureView !== undefined) {
                    entry.textureViewSerial = e.textureView.traceSerial;
                }
                if (e.sampler !== undefined) {
                    entry.samplerSerial = e.sampler.traceSerial;
                }
                if (e.buffer !== undefined) {
                    entry.bufferSerial = e.buffer.traceSerial;
                    entry.offset = e.offset;
                    entry.size = e.size;
                }
                return entry;
            }),
        };
    }
}

interface ImplicitBindGroupLayoutDescriptor {
    implicit: boolean;
    renderPipeline: RenderPipelineState;
    groupIndex: number;
}

class BindGroupLayoutState extends BaseState<GPUBindGroupLayout> {
    device: DeviceState;
    implicit?: boolean;
    entries?: TraceExplicitBindGroupEntry[];
    parentRenderPipeline: any;
    pipelineGroupIndex: any;

    constructor(device: DeviceState, desc: GPUBindGroupLayoutDescriptor | ImplicitBindGroupLayoutDescriptor) {
        const implicitDesc = desc as ImplicitBindGroupLayoutDescriptor;
        const explicitDesc = desc as GPUBindGroupLayoutDescriptor;
        super(implicitDesc.implicit ? undefined : explicitDesc);
        this.device = device;

        // TODO: this is confusing. Sometimes this is called with a GPUBindGroupLayoutDescriptor
        // and sometimes it's called from RenderPipelineState.getBindGroupLayout with entirely
        // different parameters. Should this be refactored?
        this.implicit = implicitDesc.implicit;
        if (this.implicit) {
            this.parentRenderPipeline = implicitDesc.renderPipeline;
            this.pipelineGroupIndex = implicitDesc.groupIndex;
            return;
        }

        this.entries = (explicitDesc.entries as GPUBindGroupLayoutEntry[]).map(e => {
            const entry: TraceExplicitBindGroupEntry = { binding: e.binding, visibility: e.visibility };
            if (e.buffer) {
                entry.buffer = {
                    type: e.buffer.type ?? 'uniform',
                    hasDynamicOffset: e.buffer.hasDynamicOffset ?? false,
                    minBindingSize: e.buffer.minBindingSize ?? 0,
                };
            }
            if (e.sampler) {
                entry.sampler = {
                    type: e.sampler.type ?? 'filtering',
                };
            }
            if (e.texture) {
                entry.texture = {
                    sampleType: e.texture.sampleType ?? 'float',
                    viewDimension: e.texture.viewDimension ?? '2d',
                    multisampled: e.texture.multisampled ?? false,
                };
            }
            if (e.storageTexture) {
                entry.storageTexture = {
                    access: e.storageTexture.access ?? 'write-only',
                    format: e.storageTexture.format,
                    viewDimension: e.storageTexture.viewDimension ?? '2d',
                };
            }
            if (e.externalTexture) {
                entry.externalTexture = {};
            }
            return entry;
        });
    }

    serialize(): TraceBindGroupLayout {
        if (this.implicit) {
            const b: TraceImplicitBindGroupLayout = {
                deviceSerial: this.device.traceSerial,
                renderPipelineSerial: this.parentRenderPipeline.traceSerial,
                groupIndex: this.pipelineGroupIndex,
            };
            return b;
        } else {
            const b: TraceExplicitBindGroupLayout = {
                deviceSerial: this.device.traceSerial,
                entries: this.entries!, // TODO deep copy?
            };
            return b;
        }
    }
}

type MappedRange = {
    arrayBuf: ArrayBuffer;
    offset: number;
    size: number;
};

class BufferState extends BaseState<GPUBuffer> {
    device: DeviceState;
    usage: number;
    size: number;
    state: string;
    mappedRanges: MappedRange[];

    constructor(device: DeviceState, desc: GPUBufferDescriptor) {
        super(desc);
        this.device = device;
        this.usage = desc.usage;
        this.size = desc.size;
        this.state = desc.mappedAtCreation ? 'mapped-at-creation' : 'unmapped';
        this.mappedRanges = [];
    }

    async serializeAsync(): Promise<TraceBuffer> {
        // Always serialize the creation parameters and add the initial data if possible.
        const result = this.serialize();

        // TODO handle mappable buffers.
        if ((this.usage & (GPUBufferUsage.MAP_READ | GPUBufferUsage.MAP_WRITE)) !== 0) {
            return result;
        }

        // Immediately copy the buffer contents to save its initial data to the side.
        let initialDataBuffer: GPUBuffer | undefined;
        let mapPromise = null;
        spector2.doWebGPUOp(() => {
            initialDataBuffer = this.device.webgpuObject?.createBuffer({
                size: this.size,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
            });

            // TODO pool encoders?
            const encoder = this.device.webgpuObject!.createCommandEncoder();
            encoder.copyBufferToBuffer(this.webgpuObject!, 0, initialDataBuffer!, 0, this.size);
            this.device.webgpuObject!.queue.submit([encoder.finish()]);

            mapPromise = initialDataBuffer!.mapAsync(GPUMapMode.READ);
        });

        await mapPromise;

        spector2.doWebGPUOp(() => {
            const data = initialDataBuffer!.getMappedRange();
            result.initialData = spector2.traceData(data, 0, this.size);
            initialDataBuffer!.destroy();
        });

        return result;
    }

    serialize(): TraceBuffer {
        // Still called on creation during the trace
        return {
            deviceSerial: this.device.traceSerial,
            usage: this.usage,
            size: this.size,
            state: this.state,
        };
    }

    getMappedRange(offset: number, size: number) {
        // TODO: support getting multiple small ranges and updating them on unmap.
        console.assert(offset === undefined && size === undefined);

        offset ??= 0;
        size ??= Math.max(this.size - offset);

        const arrayBuf = spector2.bufferProto.getMappedRange.call(this.webgpuObject, offset, size);
        this.mappedRanges.push({ arrayBuf, offset, size });
        return arrayBuf;
    }

    unmap() {
        if (spector2.recordingTrace()) {
            spector2.traceCommand({
                name: 'bufferUpdateData',
                bufferSerial: this.traceSerial,
                updates: this.mappedRanges.map(({ arrayBuf, offset, size }) => {
                    return {
                        data: spector2.traceData(arrayBuf, 0, size),
                        offset,
                        size,
                    };
                }),
            });
            spector2.traceCommand({
                name: 'bufferUnmap',
                bufferSerial: this.traceSerial,
            });
        }

        spector2.bufferProto.unmap.call(this.webgpuObject);
        this.mappedRanges = [];
    }

    destroy() {
        spector2.bufferProto.destroy.call(this.webgpuObject);
        this.mappedRanges = [];
    }
}

class CommandBufferState extends BaseState<GPUCommandBuffer> {
    device: DeviceState;
    commands: any;

    constructor(encoder: CommandEncoderState, desc: GPUCommandBufferDescriptor) {
        super(desc);
        this.device = encoder.device;
        this.commands = encoder.commands;
        // TODO get commands?
    }

    serialize(): TraceCommandBuffer {
        return { commands: this.commands, deviceSerial: this.device.traceSerial };
    }
}

class CommandEncoderState extends BaseState<GPUCommandEncoder> {
    device: DeviceState;
    commands: TraceCommandBufferCommand[];
    referencedObjects: Set<any>;

    constructor(device: DeviceState, desc: GPUCommandEncoderDescriptor) {
        super(desc);
        this.device = device;
        this.commands = [];
        this.referencedObjects = new Set();
    }

    serialize() {
        return {};
    }

    reference(object: any) {
        this.referencedObjects.add(object);
    }

    addCommand(command: TraceCommandBufferCommand) {
        this.commands.push(command);
    }

    beginRenderPass(desc: GPURenderPassDescriptor) {
        const pass = spector2.commandEncoderProto.beginRenderPass.call(this.webgpuObject, desc);
        spector2.registerObjectIn('renderPassEncoders', pass, new RenderPassEncoderState(this, desc));
        return pass;
    }

    copyTextureToTexture(source: GPUImageCopyTexture, destination: GPUImageCopyTexture, copySize: GPUExtent3D) {
        spector2.commandEncoderProto.copyTextureToTexture.call(this.webgpuObject, source, destination, copySize);
        this.addCommand({
            name: 'copyTextureToTexture',
            args: {
                source: {
                    textureSerial: spector2.textures.get(source.texture)!.traceSerial,
                    mipLevel: source.mipLevel ?? 0,
                    origin: source.origin ?? {}, // TODO copy
                    aspect: source.aspect ?? 'all',
                },
                destination: {
                    textureSerial: spector2.textures.get(destination.texture)!.traceSerial,
                    mipLevel: destination.mipLevel ?? 0,
                    origin: destination.origin ?? {}, // TODO copy
                    aspect: destination.aspect ?? 'all',
                },
                copySize, // TODO copy
            },
        });
        this.reference(source.texture);
        this.reference(destination.texture);
    }

    copyBufferToTexture(source: GPUImageCopyBuffer, destination: GPUImageCopyTexture, copySize: GPUExtent3D) {
        spector2.commandEncoderProto.copyBufferToTexture.call(this.webgpuObject, source, destination, copySize);
        this.addCommand({
            name: 'copyBufferToTexture',
            args: {
                source: {
                    bufferSerial: spector2.buffers.get(source.buffer)!.traceSerial,
                    offset: source.offset ?? 0,
                    bytesPerRow: source.bytesPerRow,
                    rowsPerImage: source.rowsPerImage,
                },
                destination: {
                    textureSerial: spector2.textures.get(destination.texture)!.traceSerial,
                    mipLevel: destination.mipLevel ?? 0,
                    origin: destination.origin ?? {}, // TODO copy
                    aspect: destination.aspect ?? 'all',
                },
                copySize, // TODO copy
            },
        });
        this.reference(source.buffer);
        this.reference(destination.texture);
    }

    finish(desc: GPUCommandBufferDescriptor) {
        const commandBuffer = spector2.commandEncoderProto.finish.call(this.webgpuObject, desc);
        spector2.registerObjectIn('commandBuffers', commandBuffer, new CommandBufferState(this, desc ?? {}));
        return commandBuffer;
    }

    popDebugGroup() {
        spector2.commandEncoderProto.popDebugGroup.call(this.webgpuObject);
        this.addCommand({ name: 'popDebugGroup' });
    }

    pushDebugGroup(groupLabel: string) {
        spector2.commandEncoderProto.pushDebugGroup.call(this.webgpuObject, groupLabel);
        this.addCommand({
            name: 'pushDebugGroup',
            args: {
                groupLabel,
            },
        });
    }
}

class CanvasContextState extends BaseState<GPUCanvasContext> {
    canvas: HTMLCanvasElement | OffscreenCanvas;
    getCurrentTextureCount: number;
    device?: DeviceState;
    format: GPUTextureFormat = 'rgba8unorm';
    usage = 0;
    viewFormats: GPUTextureFormat[] = [];
    colorSpace = '';
    alphaMode = '';

    constructor(canvas: HTMLCanvasElement | OffscreenCanvas) {
        super({});
        this.canvas = canvas;
        this.getCurrentTextureCount = 0;
    }

    configure(config: GPUCanvasConfiguration) {
        this.device = spector2.devices.get(config.device);
        this.format = config.format;
        this.usage = config.usage ?? GPUTextureUsage.RENDER_ATTACHMENT;
        // TODO: remove
        this.usage |= GPUTextureUsage.TEXTURE_BINDING;
        this.viewFormats = (config.viewFormats as GPUTextureFormat[]) ?? []; // TODO clone the inside
        this.colorSpace = config.colorSpace ?? 'srgb';
        this.alphaMode = config.alphaMode ?? 'opaque';

        spector2.canvasContextProto.configure.call(this.webgpuObject, {
            device: this.device!.webgpuObject,
            format: this.format,
            usage: this.usage | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
            viewFormats: this.viewFormats,
            colorSpace: this.colorSpace,
            alphaMode: this.alphaMode,
        });
    }

    unconfigure() {
        spector2.canvasContextProto.unconfigure.call(this.webgpuObject);
    }

    getCurrentTexture() {
        const texture = spector2.canvasContextProto.getCurrentTexture.call(this.webgpuObject);
        const textureState = new TextureState(
            this.device!,
            {
                format: this.format,
                size: { width: this.canvas.width, height: this.canvas.height, depthOrArrayLayers: 1 },
                usage: this.usage,
                viewFormats: this.viewFormats,
            },
            /* swapChainId */ `gct: ${(this.canvas as HTMLCanvasElement).id || '*'}-${this.getCurrentTextureCount++}`
        );
        spector2.registerObjectIn('textures', texture, textureState);

        // Mark the texture as presented right after the animation frame.
        const recordingThePresent = spector2.recordingTrace();

        const presentPromise = new Promise<void>(resolve => {
            requestAnimationFrame(() => {
                setTimeout(() => {
                    if (recordingThePresent) {
                        spector2.traceCommand({
                            name: 'present',
                            args: { canvasContextSerial: this.traceSerial, textureSerial: textureState.traceSerial },
                        });
                    }
                    textureState.onPresent();
                    resolve();
                }, 0);
            });
        });

        if (recordingThePresent) {
            spector2.addPendingTraceOperation(presentPromise);
        }

        return texture;
    }
}

class DeviceState extends BaseState<GPUDevice> {
    adapter: AdapterState;

    constructor(adapter: AdapterState, desc: GPUDeviceDescriptor) {
        super(desc);
        this.adapter = adapter;
    }

    serialize(): TraceDevice {
        return { adapterSerial: this.adapter.traceSerial };
    }

    createBindGroup(desc: GPUBindGroupDescriptor) {
        const bg = spector2.deviceProto.createBindGroup.call(this.webgpuObject, desc);
        spector2.registerObjectIn('bindGroups', bg, new BindGroupState(this, desc));
        return bg;
    }

    createBindGroupLayout(desc: GPUBindGroupLayoutDescriptor) {
        const bgl = spector2.deviceProto.createBindGroupLayout.call(this.webgpuObject, desc);
        spector2.registerObjectIn('bindGroupLayouts', bgl, new BindGroupLayoutState(this, desc));
        return bgl;
    }

    createBuffer(desc: GPUBufferDescriptor) {
        let newUsage = desc.usage;
        if ((desc.usage & (GPUBufferUsage.MAP_READ | GPUBufferUsage.MAP_WRITE)) === 0) {
            newUsage = desc.usage | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST;
        }
        const buffer = spector2.deviceProto.createBuffer.call(this.webgpuObject, {
            ...desc,
            usage: newUsage,
        });
        spector2.registerObjectIn('buffers', buffer, new BufferState(this, desc));
        return buffer;
    }

    createCommandEncoder(desc: GPUCommandEncoderDescriptor) {
        const encoder = spector2.deviceProto.createCommandEncoder.call(this.webgpuObject, desc);
        spector2.registerObjectIn('commandEncoders', encoder, new CommandEncoderState(this, desc ?? {}));
        return encoder;
    }

    createPipelineLayout(desc: GPUPipelineLayoutDescriptor) {
        const layout = spector2.deviceProto.createPipelineLayout.call(this.webgpuObject, desc);
        spector2.registerObjectIn('pipelineLayouts', layout, new PipelineLayoutState(this, desc));
        return layout;
    }

    createQuerySet(desc: GPUQuerySetDescriptor) {
        // TODO modify the desc for non-mappable buffers, see what to do for mappable.
        const querySet = spector2.deviceProto.createQuerySet.call(this.webgpuObject, desc);
        spector2.registerObjectIn('querySets', querySet, new QuerySetState(this, desc));
        return querySet;
    }

    createRenderPipeline(desc: GPURenderPipelineDescriptor) {
        const pipeline = spector2.deviceProto.createRenderPipeline.call(this.webgpuObject, desc);
        spector2.registerObjectIn('renderPipelines', pipeline, new RenderPipelineState(this, desc));
        return pipeline;
    }

    createSampler(desc: GPUSamplerDescriptor) {
        const module = spector2.deviceProto.createSampler.call(this.webgpuObject, desc);
        spector2.registerObjectIn('samplers', module, new SamplerState(this, desc ?? {}));
        return module;
    }

    createShaderModule(desc: GPUShaderModuleDescriptor) {
        const module = spector2.deviceProto.createShaderModule.call(this.webgpuObject, desc);
        spector2.registerObjectIn('shaderModules', module, new ShaderModuleState(this, desc));
        return module;
    }

    createTexture(desc: GPUTextureDescriptor) {
        const texture = spector2.deviceProto.createTexture.call(this.webgpuObject, {
            ...desc,
            usage: desc.usage | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
        });
        spector2.registerObjectIn('textures', texture, new TextureState(this, desc, /*swapChainId*/ ''));
        return texture;
    }
}

class PipelineLayoutState extends BaseState<GPUPipelineLayout> {
    device: DeviceState;
    bindGroupLayouts: BindGroupLayoutState[];

    constructor(device: DeviceState, desc: GPUPipelineLayoutDescriptor) {
        super(desc);
        this.device = device;
        this.bindGroupLayouts = (desc.bindGroupLayouts as GPUBindGroupLayout[]).map(bgl => {
            return spector2.bindGroupLayouts.get(bgl)!;
        });
    }

    serialize(): TracePipelineLayout {
        return {
            deviceSerial: this.device.traceSerial,
            bindGroupLayoutsSerial: this.bindGroupLayouts.map(bgl => bgl.traceSerial),
        };
    }
}

class QuerySetState extends BaseState<GPUQuerySet> {
    device: DeviceState;
    type: GPUQueryType;
    count: number;
    state: string;

    constructor(device: DeviceState, desc: GPUQuerySetDescriptor) {
        super(desc);
        this.device = device;
        this.type = desc.type;
        this.count = desc.count;
        this.state = 'valid';
    }

    serialize(): TraceQuerySet {
        return {
            deviceSerial: this.device.traceSerial,
            type: this.type,
            count: this.count,
            state: this.state,
            // TODO what about the data it contains ????
        };
    }
}

class QueueState extends BaseState<GPUQueue> {
    device: DeviceState;

    constructor(device: DeviceState, desc: any) {
        super(desc);
        this.device = device;
    }

    serialize(): TraceQueue {
        return { deviceSerial: this.device.traceSerial };
    }

    serializeWriteData(data: BufferSource, offset?: number, size?: number) {
        offset ??= 0;
        if (data instanceof ArrayBuffer) {
            size = size ?? data.byteLength - offset;
            return spector2.traceData(data, offset, size);
        } else {
            const typedData = data as TypedArray;
            size = size ?? typedData.length - offset;
            return spector2.traceData(
                data.buffer,
                offset * typedData.BYTES_PER_ELEMENT,
                size * typedData.BYTES_PER_ELEMENT
            );
        }
    }

    writeBuffer(buffer: GPUBuffer, bufferOffset: number, data: BufferSource, dataOffset: number, size: number) {
        spector2.queueProto.writeBuffer.call(this.webgpuObject, buffer, bufferOffset, data, dataOffset, size);
        if (!spector2.recordingTrace()) {
            return;
        }

        const serializedData = this.serializeWriteData(data, dataOffset, size);
        spector2.traceCommand({
            name: 'queueWriteBuffer',
            queueSerial: this.traceSerial,
            args: {
                bufferSerial: spector2.buffers.get(buffer)!.traceSerial,
                bufferOffset,
                data: serializedData,
            },
        });
    }

    writeTexture(
        destination: GPUImageCopyTexture,
        data: BufferSource,
        dataLayout: GPUImageDataLayout,
        size: GPUExtent3D
    ) {
        spector2.queueProto.writeTexture.call(this.webgpuObject, destination, data, dataLayout, size);
        if (!spector2.recordingTrace()) {
            return;
        }

        const serializedData = this.serializeWriteData(
            data,
            dataLayout.offset || 0,
            undefined /*TODO guess the correct size based on the format / size??*/
        );
        spector2.traceCommand({
            name: 'queueWriteTexture',
            queueSerial: this.traceSerial,
            args: {
                destination: {
                    textureSerial: spector2.textures.get(destination.texture)!.traceSerial,
                    mipLevel: destination.mipLevel ?? 0,
                    origin: destination.origin ?? {}, // TODO copy
                    aspect: destination.aspect ?? 'all',
                },
                data: serializedData,
                dataLayout: {
                    offset: 0,
                    bytesPerRow: dataLayout.bytesPerRow,
                    rowsPerImage: dataLayout.rowsPerImage,
                },
                size, // TODO copy
            },
        });
    }

    copyExternalImageToTexture(
        source: GPUImageCopyExternalImage,
        destination: GPUImageCopyTextureTagged,
        copySize: GPUExtent3D
    ) {
        spector2.queueProto.copyExternalImageToTexture.call(this.webgpuObject, source, destination, copySize);
        if (!spector2.recordingTrace()) {
            return;
        }

        // TODO implement me!
        console.assert(false);
    }

    submit(commandBuffers: GPUCommandBuffer[]) {
        spector2.queueProto.submit.call(this.webgpuObject, commandBuffers);
        if (!spector2.recordingTrace()) {
            return;
        }

        spector2.traceCommand({
            name: 'queueSubmit',
            queueSerial: this.traceSerial,
            args: { commandBufferSerials: commandBuffers.map(c => spector2.commandBuffers.get(c)!.traceSerial) },
        });
    }
}

class RenderPassEncoderState extends BaseState<GPURenderPassEncoder> {
    encoder: CommandEncoderState;

    constructor(encoder: CommandEncoderState, desc: GPURenderPassDescriptor) {
        super(desc);
        this.encoder = encoder;
        const serializeDesc: TraceCommandBeginRenderPassArgs = {
            colorAttachments: (desc.colorAttachments as GPURenderPassColorAttachment[]).map(a => {
                this.encoder.reference(a.view);
                this.encoder.reference(a.resolveTarget);
                return {
                    viewSerial: spector2.textureViews.get(a.view)!.traceSerial,
                    resolveTargetSerial: a.resolveTarget
                        ? spector2.textureViews.get(a.resolveTarget)!.traceSerial
                        : undefined,

                    clearValue: (a.clearValue ?? { r: 0, g: 0, b: 0, a: 0 }) as GPUColorDict,
                    loadOp: a.loadOp,
                    storeOp: a.storeOp,
                };
            }),

            timestampWrites: ((desc.timestampWrites ?? []) as GPURenderPassTimestampWrite[]).map(w => {
                this.encoder.reference(w.querySet);
                return {
                    querySetSerial: spector2.querySets.get(w.querySet)!.traceSerial,
                    queryIndex: w.queryIndex,
                    location: w.location,
                };
            }),

            occlusionQuerySetSerial: desc.occlusionQuerySet
                ? spector2.querySets.get(desc.occlusionQuerySet)!.traceSerial
                : undefined,
            maxDrawCount: desc.maxDrawCount ?? 50000000, // Yes that's the spec default.
        };
        this.encoder.reference(desc.occlusionQuerySet);

        const ds = desc.depthStencilAttachment;
        if (ds !== undefined) {
            this.encoder.reference(ds.view);
            serializeDesc.depthStencilAttachment = {
                viewSerial: spector2.textureViews.get(ds.view)!.traceSerial,

                depthClearValue: ds.depthClearValue ?? 0,
                depthLoadOp: ds.depthLoadOp,
                depthStoreOp: ds.depthStoreOp,
                depthReadOnly: ds.depthReadOnly ?? false,

                stencilClearValue: ds.stencilClearValue ?? 0,
                stencilLoadOp: ds.stencilLoadOp,
                stencilStoreOp: ds.stencilStoreOp,
                stencilReadOnly: ds.stencilReadOnly ?? false,
            };
        }

        this.encoder.addCommand({
            name: 'beginRenderPass',
            args: serializeDesc,
        });
    }

    serialize() {
        return {};
    }

    draw(vertexCount: number, instanceCount?: number, firstVertex?: number, firstInstance?: number) {
        spector2.renderPassEncoderProto.draw.call(
            this.webgpuObject,
            vertexCount,
            instanceCount,
            firstVertex,
            firstInstance
        );
        this.encoder.addCommand({
            name: 'draw',
            args: {
                vertexCount,
                instanceCount: instanceCount ?? 1,
                firstVertex: firstVertex ?? 0,
                firstInstance: firstInstance ?? 0,
            },
        });
    }

    drawIndexed(
        indexCount: number,
        instanceCount?: number,
        firstIndex?: number,
        baseVertex?: number,
        firstInstance?: number
    ) {
        spector2.renderPassEncoderProto.drawIndexed.call(
            this.webgpuObject,
            indexCount,
            instanceCount,
            firstIndex,
            baseVertex,
            firstInstance
        );
        this.encoder.addCommand({
            name: 'drawIndexed',
            args: {
                indexCount,
                instanceCount: instanceCount ?? 1,
                firstIndex: firstIndex ?? 0,
                baseVertex: baseVertex ?? 0,
                firstInstance: firstInstance ?? 0,
            },
        });
    }

    popDebugGroup() {
        spector2.renderPassEncoderProto.popDebugGroup.call(this.webgpuObject);
        this.encoder.addCommand({ name: 'popDebugGroup' });
    }

    pushDebugGroup(groupLabel: string) {
        spector2.renderPassEncoderProto.pushDebugGroup.call(this.webgpuObject, groupLabel);
        this.encoder.addCommand({
            name: 'pushDebugGroup',
            args: {
                groupLabel,
            },
        });
    }

    setBindGroup(index: number, bindGroup: GPUBindGroup, dynamicOffsets?: number[]) {
        if (dynamicOffsets !== undefined) {
            console.assert(false, "Don't know how to handle dynamic bindgroups yet.");
        }

        spector2.renderPassEncoderProto.setBindGroup.call(this.webgpuObject, index, bindGroup);
        this.encoder.reference(bindGroup);
        this.encoder.addCommand({
            name: 'setBindGroup',
            args: {
                index,
                bindGroupSerial: spector2.bindGroups.get(bindGroup)!.traceSerial,
                dynamicOffsets: window.structuredClone(dynamicOffsets),
            },
        });
    }

    setIndexBuffer(buffer: GPUBuffer, indexFormat: GPUIndexFormat, offset?: number, size?: number) {
        spector2.renderPassEncoderProto.setIndexBuffer.call(this.webgpuObject, buffer, indexFormat, offset, size);
        this.encoder.reference(buffer);
        const bufferState = spector2.buffers.get(buffer)!;
        offset = offset ?? 0;
        size = size ?? Math.max(0, bufferState.size - offset);
        this.encoder.addCommand({
            name: 'setIndexBuffer',
            args: {
                bufferSerial: bufferState.traceSerial,
                indexFormat,
                offset,
                size,
            },
        });
    }

    setPipeline(pipeline: GPURenderPipeline) {
        spector2.renderPassEncoderProto.setPipeline.call(this.webgpuObject, pipeline);
        this.encoder.reference(pipeline);
        this.encoder.addCommand({
            name: 'setPipeline',
            args: {
                pipelineSerial: spector2.renderPipelines.get(pipeline)!.traceSerial,
            },
        });
    }

    setVertexBuffer(slot: number, buffer: GPUBuffer, offset?: number, size?: number) {
        spector2.renderPassEncoderProto.setVertexBuffer.call(this.webgpuObject, slot, buffer, offset, size);
        this.encoder.reference(buffer);
        const bufferState = spector2.buffers.get(buffer)!;
        offset = offset ?? 0;
        size = size ?? Math.max(0, bufferState.size - offset);
        this.encoder.addCommand({
            name: 'setVertexBuffer',
            args: {
                slot,
                bufferSerial: bufferState.traceSerial,
                offset,
                size,
            },
        });
    }

    setScissorRect(x: number, y: number, width: number, height: number) {
        spector2.renderPassEncoderProto.setScissorRect.call(this.webgpuObject, x, y, width, height);
        this.encoder.addCommand({
            name: 'setScissorRect',
            args: { x, y, width, height },
        });
    }

    setViewport(x: number, y: number, width: number, height: number, minDepth: number, maxDepth: number) {
        spector2.renderPassEncoderProto.setViewport.call(this.webgpuObject, x, y, width, height, minDepth, maxDepth);
        this.encoder.addCommand({
            name: 'setViewport',
            args: { x, y, width, height, minDepth, maxDepth },
        });
    }

    end() {
        spector2.renderPassEncoderProto.end.call(this.webgpuObject);
        this.encoder.addCommand({ name: 'endPass' });
    }
}

/*
interface Attribute {
    format: string;
    offset: number;
    shaderLocation: number;
}

interface VertexBuffer {
    arrayStride: number;
    stepMode: string;
    attributes: Attribute[];
}
*/

class RenderPipelineState extends BaseState<GPURenderPipeline> {
    device: DeviceState;
    layout: GPUPipelineLayout | string;
    vertex: {
        module: ShaderModuleState;
        entryPoint: string;
        constants: Record<string, number>;
        buffers: GPUVertexBufferLayout[];
    };
    primitive: GPUPrimitiveState;
    depthStencil?: GPUDepthStencilState;
    multisample: GPUMultisampleState;
    fragment?: {
        module: ShaderModuleState;
        entryPoint: string;
        constants: Record<string, number>;
        targets: GPUColorTargetState[];
    };

    constructor(device: DeviceState, desc: GPURenderPipelineDescriptor) {
        super(desc);
        this.device = device;
        this.layout = desc.layout;

        const v = desc.vertex;
        this.vertex = {
            module: spector2.shaderModules.get(v.module)!,
            entryPoint: v.entryPoint,
            constants: { ...v.constants },

            buffers: ((v.buffers as GPUVertexBufferLayout[]) ?? []).map(b => {
                return {
                    arrayStride: b.arrayStride,
                    stepMode: b.stepMode ?? 'vertex',
                    attributes: (b.attributes as GPUVertexAttribute[]).map(a => {
                        return {
                            format: a.format,
                            offset: a.offset,
                            shaderLocation: a.shaderLocation,
                        };
                    }),
                };
            }),
        };

        const p = desc.primitive ?? {};
        this.primitive = {
            topology: p.topology ?? 'triangle-list',
            stripIndexFormat: p.stripIndexFormat,
            frontFace: p.frontFace ?? 'ccw',
            cullMode: p.cullMode ?? 'none',

            unclippedDepth: p.unclippedDepth,
        };

        const ds = desc.depthStencil;
        if (ds !== undefined) {
            const stencilFront = ds.stencilFront ?? {};
            const stencilBack = ds.stencilBack ?? {};

            this.depthStencil = {
                format: ds.format,

                depthWriteEnabled: ds.depthWriteEnabled ?? false,
                depthCompare: ds.depthCompare ?? 'always',

                stencilFront: {
                    compare: stencilFront.compare ?? 'always',
                    failOp: stencilFront.failOp ?? 'keep',
                    depthFailOp: stencilFront.depthFailOp ?? 'keep',
                    passOp: stencilFront.passOp ?? 'keep',
                },
                stencilBack: {
                    compare: stencilBack.compare ?? 'always',
                    failOp: stencilBack.failOp ?? 'keep',
                    depthFailOp: stencilBack.depthFailOp ?? 'keep',
                    passOp: stencilBack.passOp ?? 'keep',
                },

                stencilReadMask: ds.stencilReadMask ?? 0xffffffff,
                stencilWriteMask: ds.stencilWriteMask ?? 0xffffffff,

                depthBias: ds.depthBias ?? 0,
                depthBiasSlopeScale: ds.depthBiasSlopeScale ?? 0,
                depthBiasClamp: ds.depthBiasClamp ?? 0,
            };
        }

        const m = desc.multisample ?? {};
        this.multisample = {
            count: m.count ?? 1,
            mask: m.mask ?? 0xffffffff,
            alphaToCoverageEnabled: m.alphaToCoverageEnabled ?? false,
        };

        const f = desc.fragment;
        if (f !== undefined) {
            this.fragment = {
                module: spector2.shaderModules.get(f.module)!,
                entryPoint: f.entryPoint,
                constants: { ...f.constants },

                targets: (f.targets as GPUColorTargetState[]).map(t => {
                    const target: GPUColorTargetState = {
                        format: t.format,
                        writeMask: t.writeMask ?? GPUColorWrite.ALL,
                    };

                    const b = t.blend;
                    if (b !== undefined) {
                        target.blend = {
                            color: {
                                operation: b.color.operation ?? 'add',
                                srcFactor: b.color.srcFactor ?? 'one',
                                dstFactor: b.color.dstFactor ?? 'zero',
                            },
                            alpha: {
                                operation: b.alpha.operation ?? 'add',
                                srcFactor: b.alpha.srcFactor ?? 'one',
                                dstFactor: b.alpha.dstFactor ?? 'zero',
                            },
                        };
                    }

                    return target;
                }),
            };
        }
    }

    serialize(): TraceRenderPipeline {
        const { vertex, layout, primitive, multisample, depthStencil, fragment } = this;
        const result: TraceRenderPipeline = {
            deviceSerial: this.device.traceSerial,
            vertex: {
                moduleSerial: vertex.module.traceSerial,
                entryPoint: vertex.entryPoint,
                constants: vertex.constants,
                buffers: vertex.buffers,
            },
            primitive,
            multisample,
            depthStencil,
            //fragment: { ...this.fragment },
        };

        if (layout === 'auto') {
            result.layout = 'auto';
        } else {
            result.layoutSerial = spector2.pipelineLayouts.get(layout as GPUPipelineLayout)!.traceSerial;
        }

        if (fragment !== undefined) {
            result.fragment = {
                moduleSerial: fragment.module.traceSerial,
                entryPoint: fragment.entryPoint,
                constants: fragment.constants,
                targets: fragment.targets,
            };
        }

        return result;
    }

    getBindGroupLayout(groupIndex: number) {
        const bgl = spector2.renderPipelineProto.getBindGroupLayout.call(this.webgpuObject, groupIndex);
        spector2.registerObjectIn(
            'bindGroupLayouts',
            bgl,
            new BindGroupLayoutState(this.device, {
                implicit: true,
                renderPipeline: this,
                groupIndex,
            })
        );
        return bgl;
    }
}

class SamplerState extends BaseState<GPUSampler> {
    device: DeviceState;
    desc: TraceSamplerState;

    constructor(device: DeviceState, desc: GPUSamplerDescriptor) {
        super(desc);
        this.device = device;
        this.desc = {
            addressModeU: desc.addressModeU ?? 'clamp-to-edge',
            addressModeV: desc.addressModeV ?? 'clamp-to-edge',
            addressModeW: desc.addressModeW ?? 'clamp-to-edge',
            magFilter: desc.magFilter ?? 'nearest',
            minFilter: desc.minFilter ?? 'nearest',
            mipmapFilter: desc.mipmapFilter ?? 'nearest',
            lodMinClamp: desc.lodMinClamp ?? 0,
            lodMaxClamp: desc.lodMaxClamp ?? 32,
            compare: desc.compare,
            maxAnisotropy: desc.maxAnisotropy ?? 1,
        };
    }

    serialize(): TraceSampler {
        return {
            deviceSerial: this.device.traceSerial,
            ...this.desc,
        };
    }
}

class ShaderModuleState extends BaseState<GPUShaderModule> {
    device: DeviceState;
    code: string;

    constructor(device: DeviceState, desc: GPUShaderModuleDescriptor) {
        super(desc);
        this.device = device;
        this.code = desc.code;
    }

    serialize(): TraceShaderModule {
        return { deviceSerial: this.device.traceSerial, code: this.code };
    }
}

type TextureFormatInfo = {
    type: string;
    blockWidth?: number;
    blockHeight?: number;
    blockByteSize?: number;
};

const c111 = { type: 'color', blockWidth: 1, blockHeight: 1, blockByteSize: 1 };
const c112 = { type: 'color', blockWidth: 1, blockHeight: 1, blockByteSize: 2 };
const c114 = { type: 'color', blockWidth: 1, blockHeight: 1, blockByteSize: 4 };
const c118 = { type: 'color', blockWidth: 1, blockHeight: 1, blockByteSize: 8 };
const c1116 = { type: 'color', blockWidth: 1, blockHeight: 1, blockByteSize: 16 };

const c448 = { type: 'color', blockWidth: 4, blockHeight: 4, blockByteSize: 8 };
const c4416 = { type: 'color', blockWidth: 4, blockHeight: 4, blockByteSize: 16 };
const c5416 = { type: 'color', blockWidth: 5, blockHeight: 4, blockByteSize: 16 };

const c5516 = { type: 'color', blockWidth: 5, blockHeight: 5, blockByteSize: 16 };
const c6516 = { type: 'color', blockWidth: 6, blockHeight: 5, blockByteSize: 16 };
const c6616 = { type: 'color', blockWidth: 6, blockHeight: 6, blockByteSize: 16 };
const c8516 = { type: 'color', blockWidth: 8, blockHeight: 5, blockByteSize: 16 };
const c8616 = { type: 'color', blockWidth: 8, blockHeight: 6, blockByteSize: 16 };
const c8816 = { type: 'color', blockWidth: 8, blockHeight: 8, blockByteSize: 16 };
const c10516 = { type: 'color', blockWidth: 10, blockHeight: 5, blockByteSize: 16 };
const c10616 = { type: 'color', blockWidth: 10, blockHeight: 6, blockByteSize: 16 };
const c10816 = { type: 'color', blockWidth: 10, blockHeight: 8, blockByteSize: 16 };
const c101016 = { type: 'color', blockWidth: 10, blockHeight: 10, blockByteSize: 16 };
const c121016 = { type: 'color', blockWidth: 12, blockHeight: 10, blockByteSize: 16 };
const c121216 = { type: 'color', blockWidth: 12, blockHeight: 12, blockByteSize: 16 };

export const kTextureFormatInfo: Record<GPUTextureFormat, TextureFormatInfo> = {
    r8unorm: c111,
    r8snorm: c111,
    r8uint: c111,
    r8sint: c111,
    rg8unorm: c112,
    rg8snorm: c112,
    rg8uint: c112,
    rg8sint: c112,
    rgba8unorm: c114,
    'rgba8unorm-srgb': c114,
    rgba8snorm: c114,
    rgba8uint: c114,
    rgba8sint: c114,
    bgra8unorm: c114,
    'bgra8unorm-srgb': c114,
    r16uint: c112,
    r16sint: c112,
    r16float: c112,
    rg16uint: c114,
    rg16sint: c114,
    rg16float: c114,
    rgba16uint: c118,
    rgba16sint: c118,
    rgba16float: c118,
    r32uint: c114,
    r32sint: c114,
    r32float: c114,
    rg32uint: c118,
    rg32sint: c118,
    rg32float: c118,
    rgba32uint: c1116,
    rgba32sint: c1116,
    rgba32float: c1116,
    rgb10a2unorm: c114,
    rg11b10ufloat: c114,
    rgb9e5ufloat: c114,

    stencil8: { type: 'stencil', blockByteSize: 1 },
    depth16unorm: { type: 'depth', blockWidth: 1, blockHeight: 1, blockByteSize: 2 },
    depth32float: { type: 'depth', blockWidth: 1, blockHeight: 1, blockByteSize: 4 },
    'depth24plus-stencil8': { type: 'depth-stencil' },
    depth24plus: { type: 'depth', blockWidth: 1, blockHeight: 1, blockByteSize: 4 },
    'depth32float-stencil8': { type: 'depth-stencil' },

    'bc1-rgba-unorm': c448,
    'bc1-rgba-unorm-srgb': c448,
    'bc2-rgba-unorm': c4416,
    'bc2-rgba-unorm-srgb': c4416,
    'bc3-rgba-unorm': c4416,
    'bc3-rgba-unorm-srgb': c4416,
    'bc4-r-unorm': c448,
    'bc4-r-snorm': c448,
    'bc5-rg-unorm': c4416,
    'bc5-rg-snorm': c4416,
    'bc6h-rgb-ufloat': c4416,
    'bc6h-rgb-float': c4416,
    'bc7-rgba-unorm': c4416,
    'bc7-rgba-unorm-srgb': c4416,
    'etc2-rgb8unorm': c448,
    'etc2-rgb8unorm-srgb': c448,
    'etc2-rgb8a1unorm': c448,
    'etc2-rgb8a1unorm-srgb': c448,
    'etc2-rgba8unorm': c4416,
    'etc2-rgba8unorm-srgb': c4416,
    'eac-r11unorm': c448,
    'eac-r11snorm': c448,
    'eac-rg11unorm': c4416,
    'eac-rg11snorm': c4416,
    'astc-4x4-unorm': c4416,
    'astc-4x4-unorm-srgb': c4416,
    'astc-5x4-unorm': c5416,
    'astc-5x4-unorm-srgb': c5416,
    'astc-5x5-unorm': c5516,
    'astc-5x5-unorm-srgb': c5516,
    'astc-6x5-unorm': c6516,
    'astc-6x5-unorm-srgb': c6516,
    'astc-6x6-unorm': c6616,
    'astc-6x6-unorm-srgb': c6616,
    'astc-8x5-unorm': c8516,
    'astc-8x5-unorm-srgb': c8516,
    'astc-8x6-unorm': c8616,
    'astc-8x6-unorm-srgb': c8616,
    'astc-8x8-unorm': c8816,
    'astc-8x8-unorm-srgb': c8816,
    'astc-10x5-unorm': c10516,
    'astc-10x5-unorm-srgb': c10516,
    'astc-10x6-unorm': c10616,
    'astc-10x6-unorm-srgb': c10616,
    'astc-10x8-unorm': c10816,
    'astc-10x8-unorm-srgb': c10816,
    'astc-10x10-unorm': c101016,
    'astc-10x10-unorm-srgb': c101016,
    'astc-12x10-unorm': c121016,
    'astc-12x10-unorm-srgb': c121016,
    'astc-12x12-unorm': c121216,
    'astc-12x12-unorm-srgb': c121216,
};
const kBytesPerRowAlignment = 256;

function align(n: number, alignment: number) {
    return Math.ceil(n / alignment) * alignment;
}

class TextureState extends BaseState<GPUTexture> {
    device: DeviceState;
    swapChainId?: string;
    state: string;
    format: GPUTextureFormat;
    usage: GPUTextureUsageFlags;
    size: GPUExtent3DDictFull;
    dimension: GPUTextureDimension;
    mipLevelCount: number;
    sampleCount: number;
    viewFormats: GPUTextureFormat[];

    constructor(device: DeviceState, desc: GPUTextureDescriptor, swapChainId?: string) {
        super(desc);
        this.swapChainId = swapChainId; // a string if texture is from `getCurrentTexture`
        this.state = 'available';
        this.device = device;
        this.format = desc.format;
        this.usage = desc.usage;
        this.size = gpuExtent3DDictFullFromGPUExtent3D(desc.size);
        this.dimension = desc.dimension ?? '2d';
        this.mipLevelCount = desc.mipLevelCount ?? 1;
        this.sampleCount = desc.sampleCount ?? 1;
        this.viewFormats = [...(desc.viewFormats ?? [])]; // deep copy
    }

    async serializeAsync(): Promise<TraceTexture> {
        // Always serialize the creation parameters and add the initial data if possible.
        const result = this.serialize();

        // No need to gather initial data since this texture is already destroyed.
        if (this.state === 'destroyed') {
            return result;
        }

        if (this.swapChainId) {
            // TODO: We should be able to make this work but it's hard to track exactly when these textures are destroyed.
            console.warn('No support for swapChain texture initial data.');
            return result;
        }
        if (this.sampleCount !== 1) {
            console.warn('No support for sampleCount > 1 texture initial data.');
            return result;
        }
        if (this.dimension !== '2d') {
            console.warn("No support for dimension != '2d' texture initial data.");
            return result;
        }
        if (kTextureFormatInfo[this.format].type !== 'color') {
            console.warn('No support for non-color texture initial data.');
            return result;
        }
        // TODO check for compressed textures as well.

        const { blockByteSize } = kTextureFormatInfo[this.format]!;

        type Readback = { buffer: GPUBuffer; bytesPerRow: number; mipLevel: number };
        const readbacks: Readback[] = [];
        let mapPromises: Promise<void>[] = [];

        spector2.doWebGPUOp(() => {
            // TODO pool encoders?
            const encoder = this.device.webgpuObject!.createCommandEncoder();

            for (let mip = 0; mip < this.mipLevelCount; mip++) {
                const width = Math.max(1, this.size.width >> mip);
                const height = Math.max(1, this.size.height >> mip);
                const depthOrArrayLayers = this.size.depthOrArrayLayers; // TODO support 3D.
                const bytesPerRow = align(width * blockByteSize!, kBytesPerRowAlignment);
                const bufferSize = bytesPerRow * height * depthOrArrayLayers;

                const readbackBuffer = this.device.webgpuObject!.createBuffer({
                    size: bufferSize,
                    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
                });

                encoder.copyTextureToBuffer(
                    { texture: this.webgpuObject!, mipLevel: mip },
                    { buffer: readbackBuffer, bytesPerRow, rowsPerImage: height },
                    { width, height, depthOrArrayLayers }
                );

                readbacks.push({ buffer: readbackBuffer, bytesPerRow, mipLevel: mip });
            }

            this.device.webgpuObject!.queue.submit([encoder.finish()]);

            mapPromises = readbacks.map(r => r.buffer.mapAsync(GPUMapMode.READ));
        });

        await Promise.all(mapPromises);

        const initialData: TraceTextureInitialData[] = [];
        spector2.doWebGPUOp(() => {
            for (const { buffer, bytesPerRow, mipLevel } of readbacks) {
                initialData.push({
                    data: spector2.traceData(buffer.getMappedRange()),
                    mipLevel,
                    bytesPerRow,
                });
                buffer.destroy();
            }
        });

        result.initialData = initialData;
        return result;
    }

    serialize(): TraceTexture {
        return {
            deviceSerial: this.device.traceSerial,
            state: this.state,
            format: this.format,
            usage: this.usage,
            size: this.size,
            dimension: this.dimension,
            mipLevelCount: this.mipLevelCount,
            sampleCount: this.sampleCount,
            viewFormats: this.viewFormats,
            swapChainId: this.swapChainId,
        };
    }

    createView(viewDesc: GPUTextureViewDescriptor) {
        const view = spector2.textureProto.createView.call(this.webgpuObject, viewDesc);
        spector2.registerObjectIn('textureViews', view, new TextureViewState(this, viewDesc ?? {}));
        return view;
    }

    onPresent() {
        this.state = 'destroyed';
    }

    destroy() {
        spector2.textureProto.destroy.call(this.webgpuObject);
        this.state = 'destroyed';

        if (!spector2.recordingTrace()) {
            return;
        }

        spector2.traceCommand({
            name: 'textureDestroy',
            textureSerial: this.traceSerial,
        });
    }

    // TODO getters lol
}

class TextureViewState extends BaseState<GPUTextureView> {
    texture: TextureState;
    format: GPUTextureFormat;
    dimension: GPUTextureViewDimension;
    aspect: GPUTextureAspect;
    baseMipLevel: number;
    mipLevelCount?: number;
    baseArrayLayer: number;
    arrayLayerCount?: number;

    constructor(texture: TextureState, desc: GPUTextureViewDescriptor) {
        super(desc);
        this.texture = texture;
        this.format = desc.format ?? texture.format;
        this.dimension = desc.dimension ?? '2d'; // TODO not actually correct
        this.aspect = desc.aspect ?? 'all';
        this.baseMipLevel = desc.baseMipLevel ?? 0;
        this.mipLevelCount = desc.mipLevelCount; // TODO default;
        this.baseArrayLayer = desc.baseArrayLayer ?? 0;
        this.arrayLayerCount = desc.arrayLayerCount; // TODO default;
    }

    serialize(): TraceTextureView {
        return {
            textureSerial: this.texture.traceSerial,
            format: this.format,
            dimension: this.dimension,
            aspect: this.aspect,
            baseMipLevel: this.baseMipLevel,
            mipLevelCount: this.mipLevelCount,
            baseArrayLayer: this.baseArrayLayer,
            arrayLayerCount: this.arrayLayerCount,
        };
    }
}

// TODO full WebIDL and exceptions on bad type? Can we automate from TS webidl definition for WebGPU??
