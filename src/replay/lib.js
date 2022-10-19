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

        this.commands = trace.commands.map(command => {
            const c = window.structuredClone(command);
            switch (c.name) {
                case 'queueSubmit':
                    c.queue = this.queues[c.queueSerial];
                    delete c.queueSerial;
                    c.args.commandBuffers = c.args.commandBufferSerials.map(serial => this.commandBuffers[serial]);
                    delete c.args.commandBufferSerials;
                    break;
                case 'present':
                    c.args.texture = this.textures[c.args.textureSerial];
                    delete c.args.textureSerial;
                    break;
                default:
                    console.assert("Unhandled command type '" + c.name + "'");
            }
            return c;
        });
    }

    // Note sure what the correct abstraction is for partial replays etc.
    execute(command) {
       switch (command.name) {
            case 'queueSubmit':
                command.queue.executeSubmit(command.args.commandBuffers);
                break;

            case 'present':
               // Nothing to do?
               break;
            default:
                console.assert("Unhandled command type '" + c.name + "'");
        }
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
        this.commands = desc.commands.map(command => {
            const c = window.structuredClone(command);
            switch (c.name) {
                case 'beginRenderPass':
                    for (const attachment of c.args.colorAttachments) {
                        attachment.viewState = this.replay.textureViews[attachment.viewSerial];
                        attachment.view = attachment.viewState.webgpuObject;
                        delete attachment.viewSerial;
                    }
                    break;
                case 'setPipeline':
                    c.args.pipeline = this.replay.renderPipelines[c.args.pipelineSerial];
                    delete c.args.pipelineSerial;
                    break;
                case 'draw':
                case 'endPass':
                    break;
                default:
                    console.assert("Unhandled command type '" + c.name + "'");
            }
            return c;
        });
    }

    encodeIn(encoder) {
        let renderPass = null;
        for (const c of this.commands) {
            switch (c.name) {
                case 'beginRenderPass': {
                    renderPass = encoder.beginRenderPass(c.args);
                    break;
                }
                case 'setPipeline':
                    renderPass.setPipeline(c.args.pipeline.webgpuObject);
                    break;
                case 'draw':
                    renderPass.draw(c.args.vertexCount, c.args.instanceCount, c.args.firstVertex, c.args.firstInstance);
                    break;
                case 'endPass':
                    renderPass.end();
                    renderPass = null;
                    break;
                default:
                    console.assert("Unhandled command type '" + c.name + "'");
            }
        }
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
        this.device = this.replay.devices[desc.deviceSerial]
        this.webgpuObject = this.device.webgpuObject.queue;
    }

    executeSubmit(commandBuffers) {
        const encoder = this.device.webgpuObject.createCommandEncoder();
        for (const commandBuffer of commandBuffers) {
            commandBuffer.encodeIn(encoder);
        }
        this.webgpuObject.submit([encoder.finish()]);
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
        this.device = this.replay.devices[desc.deviceSerial];
        this.size = desc.size;
        this.format = desc.format;

        this.webgpuObject = this.device.webgpuObject.createTexture({
            format: this.format,
            usage: desc.usage | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
            size: this.size,
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
