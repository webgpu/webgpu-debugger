class ObjectRegistry {
    constructor() {
        this.dataMap = new WeakMap();
        this.objects = [];
        this.currentTraceSerial = 0;
        this.iterating = false;
    }

    add(obj, data) {
        if (this.iterating) {
            throw "Mutating Registry while iterating it.";
        }

        this.dataMap.set(obj, data);
        this.objects.push(new WeakRef(obj));
        data.webgpuObject = object;
        data.traceSerial = this.currentTraceSerial;

    }

    get(obj) {
        return this.dataMap.get(obj);
    }

    prune() {
        if (this.iterating) {
            throw "Mutating Registry while iterating it.";
        }

        this.objects = this.objects.filter(ref => ref.deref() !== undefined);
    }

    [Symbol.iterator]() {
        let i = 0;
        let self = this;
        this.iterating = true;

        return {
            next() {
                while (i < self.objects.length) {
                    let obj = self.objects[i++].deref();
                    if (obj === undefined) {
                        continue;
                    }
                    return { value: self.get(obj), done: false };
                }
                self.iterating = false;
                return { done: true };
            }
        }
    }
}

function createPrototypeWrapper(registry, methodsToWrap) {
    let proto = {};
    for (const name of methodsToWrap) {
        proto[name] = function() {
            let self = registry.get(this)[name];
            return self[name].apply(self, arguments);
        }
    }
    return proto;
}


class Spector2 {
    constructor() {
        console.log("init spector2");
        this.canvasContexts = new ObjectRegistry();
        this.commandEncoder = new ObjectRegistry();
        this.devices = new ObjectRegistry();
        this.queues = new ObjectRegistry();
        this.renderPassEncoder = new ObjectRegistry();
        this.renderPipelines = new ObjectRegistry();
        this.shaderModules = new ObjectRegistry();
        this.textures = new ObjectRegistry();
        this.textureViews = new ObjectRegistry();

        this.canvasContextProto = Object.getPrototypeOf(GPUCanvasContext);
        this.commandEncoderProto = Object.getPrototypeOf(GPUCommandEncoder);
        this.deviceProto = Object.getPrototypeOf(GPUDevice);
        this.queueProto = Object.getPrototypeOf(GPUQueue);
        this.renderPassEncoderProto = Object.getPrototypeOf(GPURenderPassEncoder);
        this.renderPipelineProto = Object.getPrototypeOf(GPURenderPipeline);
        this.shaderModuleProto = Object.getPrototypeOf(GPUShaderModule);
        this.textureProto = Object.getPrototypeOf(GPUTexture);
        this.textureView = Object.getPrototypeOf(GPUTextureView);

        Object.setPrototypeOf(GPUCanvasContext, createPrototypeWrapper(this.canvasContexts, ['configure', 'unconfigure', 'getCurrentTextureView']));
        Object.setPrototypeOf(GPUTexture, createPrototypeWrapper(this.texturePrototype, ['destroy', 'createView']));

        console.log("replacing proto");
        let canvasProto = Object.getPrototypeOf(HTMLCanvasElement);
        Object.setPrototypeOf(HTMLCanvasElement, {
            prototype: canvasProto,
            getContext: function(type) {
                console.log("getContext");
                let context = canvasProto.apply(this, arguments);
                if (type === 'webgpu') {
                    this.canvasContext.add(context, new CanvasContextState(this));
                }
                return context;
            }
        });
    }
    // TODO add support for prune all.
}

let spector2 = new Spector2();

class BaseState {
    constructor(desc) {
        if (desc.label) {
            this.label = desc.label;
        }
        this.webgpuObj = null;
        this.tracingSerial = -1;
    }
}

class CanvasContextState extends BaseState {
    constructor(canvas) {
        super({});
        this.canvas = canvas;
    }

    configure(config) {
        this.device = config.device;
        this.format = config.format;
        this.usage = config.usage;
        this.viewFormats = config.viewFormats; // TODO clone the inside
        this.colorSpace = config.colorSpace;
        this.alphaMode = config.alphaMode;

        // TODO don't mutate incoming config, instead make a new object.
        config.usage |= GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST;
        spector2.canvasContextProto.configure.call(this.webgpuObject, config);
    }

    unconfigure() {
        spector2.canvasContextProto.unconfigure.call(this.webgpuObject);
    }

    getCurrentTexture() {
        const texture = spector2.canvasContextProto.getCurrentTexture.call(this.webgpuObject);
        spector2Registry.add(texture, new TextureState({
            format: this.format,
            size: {width: this.canvas.width, height: this.canvas.height, depthOrArrayLayers: 1},
            usage: this.usage,
            viewFormats: viewFormats,
        }));
        return texture;
    }
}

class ShaderModuleState extends BaseState {
    constructor(desc) {
        super(desc);
        this.code = desc.code;
    }
}

class TextureState extends BaseState {
    constructor(desc) {
        super(desc);
        this.format = desc.format;
        this.usage = desc.usage;
        this.size = desc.size; // TODO reify
        this.dimension = desc.dimension ?? '2d';
        this.mipLevelCount = desc.mipLevelCount ?? 1;
        this.sampleCount = desc.sampleCount ?? 1;
        this.viewFormats = desc.viewFormats ?? [];
    }

    createView(viewDesc) {
        const view = spector2.textureProto.createView.call(this.webgpuObject, viewDesc);
        spector2Registry.textureViews.add(view, new TextureViewState(this, viewDesc));
        return view;
    }

    destroy() {
        // TODO copy on write?
        // TODO store if recording trace.
        spector2.textureProto.destroy.call(webgpuObject);
    }

    // TODO getters lol
}

class TextureViewState extends BaseState {
    constructor(texture, desc) {
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
}

// TODO full WebIDL and exceptions on bad type? Can we automate from TS webidl definition for WebGPU??
