async function loadReplay(trace) {
    const replay = new Replay();
    await replay.load(trace);
    return replay;
}

class Replay {
    constructor() {
    }

    async load(trace) {
        async function recreateObjectsAsync(replay, Class, descMap) {
            if (descMap === undefined) {
                return {};
            }

            const recreatePromises = [];
            const recreatedObjects = {};
            for (const traceSerial in descMap) {
                const desc = descMap[traceSerial];
                const obj = new Class(replay, desc);

                recreatePromises.push(obj.recreate(desc));
                recreatedObjects[traceSerial] = obj;
            }

            await Promise.all(recreatePromises);
            return recreatedObjects;
        }

        function recreateObjects(replay, Class, descMap) {
            if (descMap === undefined) {
                return {};
            }

            const recreatedObjects = {};
            for (const traceSerial in descMap) {
                const desc = descMap[traceSerial];
                const obj = new Class(replay, desc);
                recreatedObjects[traceSerial] = obj;
            }
            return recreatedObjects;
        }

        this.adapters = await recreateObjectsAsync(this, ReplayAdapter, trace.objects.adapters);
        this.devices = await recreateObjectsAsync(this, ReplayDevice, trace.objects.devices);
        this.queues = recreateObjects(this, ReplayQueue, trace.objects.queues);
        this.shaderModules = recreateObjects(this, ReplayShaderModule, trace.objects.shaderModules);
        this.renderPipelines = await recreateObjectsAsync(this, ReplayRenderPipeline, trace.objects.renderPipelines);
        this.textures = recreateObjects(this, ReplayTexture, trace.objects.textures);
        this.textureViews = recreateObjects(this, ReplayTextureView, trace.objects.textureViews);
        this.commandBuffers = recreateObjects(this, ReplayCommandBuffer, trace.objects.commandBuffers);
        // GPUCommandEncoder, GPURenderPassEncoder, GPUCanvasContext not needed for replay?

        this.commands = trace.commands;
    }

}

class ReplayObject {
    constructor(replay, desc) {
        this.replay = replay;
        this.label = desc.label ?? "";
    }
}

class ReplayAdapter extends ReplayObject {
    constructor(replay, desc) {
        super(replay, desc);
    }

    async recreate(desc) {
        this.webgpuObject = await navigator.gpu.requestAdapter();
    }
}

class ReplayCommandBuffer extends ReplayObject {
    constructor(replay, desc) {
        super(replay, desc);
        this.commands = desc.commands;
    }
}

class ReplayDevice extends ReplayObject {
    constructor(replay, desc) {
        super(replay, desc);
    }

    async recreate(desc) {
        const adapter = this.replay.adapters[desc.adapterSerial].webgpuObject;
        this.webgpuObject = await adapter.requestDevice();
    }
}

class ReplayQueue extends ReplayObject {
    constructor(replay, desc) {
        super(replay, desc);
        this.webgpuObject = this.replay.devices[desc.deviceSerial].queue;
    }
}

class ReplayRenderPipeline extends ReplayObject {
    constructor(replay, desc) {
        super(replay, desc);
    }

    async recreate(desc) {
        const device = this.replay.devices[desc.deviceSerial].webgpuObject;
        const vsModule = this.replay.shaderModules[desc.vertex.moduleSerial].webgpuObject;
        const fsModule = this.replay.shaderModules[desc.fragment.moduleSerial].webgpuObject;

        // Do this properly and with all state pls.
        this.webgpuObject = await device.createRenderPipelineAsync({
            label: desc.label,
            layout: desc.layout, // Support explicit layout.
            vertex: {
                module: vsModule,
                entryPoint: desc.vertex.entryPoint,
            },
            fragment: {
                module: fsModule,
                entryPoint: desc.fragment.entryPoint,
                targets: desc.fragment.targets,
            },
        });
    }
}

class ReplayShaderModule extends ReplayObject {
    constructor(replay, desc) {
        super(replay, desc);
        const device = this.replay.devices[desc.deviceSerial];
        this.webgpuObject = device.webgpuObject.createShaderModule({
            code: desc.code,
        });
    }
}

class ReplayTexture extends ReplayObject {
    constructor(replay, desc) {
        super(replay, desc);
        const device = this.replay.devices[desc.deviceSerial];
        this.webgpuObject = device.webgpuObject.createTexture({
            format: desc.format,
            usage: desc.usage,
            size: desc.size,
            dimension: desc.dimension,
            mipLevelCount: desc.mipLevelCount,
            sampleCount: desc.sampleCount,
            viewFormats: desc.viewFormats,
        });
    }
}

class ReplayTextureView extends ReplayObject {
    constructor(replay, desc) {
        super(replay, desc);
        const texture = this.replay.textures[desc.textureSerial];
        this.webgpuObject = texture.webgpuObject.createView({
            format: desc.format,
            dimension: desc.dimension,
            aspect: desc.aspect,
            baseMipLevel: desc.baseMipLevel,
            mipLevelCount: desc.mipLevelCount,
            baseArrayLayer: desc.baseArrayLayer,
            arrayLayerCount: desc.arrayLayerCount,
        });
    }
}
