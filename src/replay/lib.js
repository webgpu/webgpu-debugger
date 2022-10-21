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

        this.data = {};
        for (const dataSerial in trace.data) {
            const badArray = trace.data[dataSerial];
            const dataBuf = new Uint8Array(badArray.length);
            for (let i = 0; i < badArray.length; i++) {
                dataBuf[i] = badArray[i];
            }
            this.data[dataSerial] = dataBuf;
        }

        this.adapters = await recreateObjectsAsync(this, ReplayAdapter, trace.objects.adapters);
        this.devices = await recreateObjectsAsync(this, ReplayDevice, trace.objects.devices);
        this.queues = recreateObjects(this, ReplayQueue, trace.objects.queues);

        this.bindGroupLayouts = recreateObjects(this, ReplayBindGroupLayout, trace.objects.bindGroupLayouts);
        this.pipelineLayouts = recreateObjects(this, ReplayPipelineLayout, trace.objects.pipelineLayouts);
        this.shaderModules = recreateObjects(this, ReplayShaderModule, trace.objects.shaderModules);
        this.renderPipelines = await recreateObjectsAsync(this, ReplayRenderPipeline, trace.objects.renderPipelines);

        this.buffers = recreateObjects(this, ReplayBuffer, trace.objects.buffers);
        this.samplers = recreateObjects(this, ReplaySampler, trace.objects.samplers);
        this.textures = recreateObjects(this, ReplayTexture, trace.objects.textures);
        this.textureViews = recreateObjects(this, ReplayTextureView, trace.objects.textureViews);
        this.querySets = recreateObjects(this, ReplayQuerySet, trace.objects.querySets);
        this.bindGroups = recreateObjects(this, ReplayBindGroup, trace.objects.bindGroups);

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
                case 'queueWriteBuffer':
                    c.queue = this.queues[c.queueSerial];
                    delete c.queueSerial;
                    c.args.buffer = this.buffers[c.args.bufferSerial];
                    delete c.args.bufferSerial;
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

    getData(serializedData) {
        const dataBuf = this.data[serializedData.serial];
        console.assert(dataBuf.byteLength === serializedData.size);
        return dataBuf;
    }

    // Note sure what the correct abstraction is for partial replays etc.
    execute(command) {
        switch (command.name) {
            case 'queueSubmit':
                command.queue.executeSubmit(command.args.commandBuffers);
                break;

            case 'queueWriteBuffer':
                const dataBuf = this.getData(command.args.data);
                command.queue.webgpuObject.writeBuffer(command.args.buffer.webgpuObject, command.args.bufferOffset, dataBuf);
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
                case 'beginRenderPass': {
                    for (const a of c.args.colorAttachments) {
                        a.viewState = this.replay.textureViews[a.viewSerial];
                        a.view = a.viewState.webgpuObject;
                        delete a.viewSerial;

                        if (a.resolveTargetSerial) {
                            a.resolveTargetState = this.replay.textureViews[a.resolveTargetSerial];
                            a.resolveTarget = a.resolveTargetState.webgpuObject;
                            delete a.resolveTargetSerial;
                        }
                    }

                    const ds = c.args.depthStencilAttachment;
                    if (ds !== undefined) {
                        ds.viewState = this.replay.textureViews[ds.viewSerial];
                        ds.view = ds.viewState.webgpuObject;
                        delete ds.viewSerial;
                    }

                    for (const w of c.args.timestampWrites) {
                        w.querySetState = this.replay.querySets[w.querySetSerial];
                        w.querySet = w.querySet.webgpuObject;
                        delete w.querySetSerial;
                    }

                    if (c.args.occlusionQuerySetSerial !== undefined) {
                        c.args.occlusionQuerySetState = this.replay.querySets[c.args.occlusionQuerySetSerial];
                        c.args.occlusionQuerySet = c.args.occlusionQuerySetState;
                        delete c.args.occlusionQuerySetSerial;
                    }

                    break;
                }
                case 'setBindGroup':
                    c.args.bindGroup = this.replay.bindGroups[c.args.bindGroupSerial];
                    delete c.args.bindGroupSerial;
                    break;
                case 'setIndexBuffer':
                    c.args.buffer = this.replay.buffers[c.args.bufferSerial];
                    delete c.args.bufferSerial;
                    break;
                case 'setPipeline':
                    c.args.pipeline = this.replay.renderPipelines[c.args.pipelineSerial];
                    delete c.args.pipelineSerial;
                    break;
                case 'setVertexBuffer':
                    c.args.buffer = this.replay.buffers[c.args.bufferSerial];
                    delete c.args.bufferSerial;
                    break;
                case 'setViewport':
                case 'draw':
                case 'drawIndexed':
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
                case 'beginRenderPass':
                    renderPass = encoder.beginRenderPass(c.args);
                    break;
                case 'draw':
                    renderPass.draw(c.args.vertexCount, c.args.instanceCount, c.args.firstVertex, c.args.firstInstance);
                    break;
                case 'drawIndexed':
                    renderPass.drawIndexed(c.args.indexCount, c.args.instanceCount, c.args.firstIndex, c.args.baseVertex, c.args.firstInstance);
                    break;
                case 'endPass':
                    renderPass.end();
                    renderPass = null;
                    break;
                case 'setBindGroup':
                    renderPass.setBindGroup(c.args.index, c.args.bindGroup.webgpuObject, c.dynamicOffsets);
                    break;
                case 'setIndexBuffer':
                    renderPass.setIndexBuffer(c.args.buffer.webgpuObject, c.args.indexFormat, c.args.offset, c.args.size);
                    break;
                case 'setPipeline':
                    renderPass.setPipeline(c.args.pipeline.webgpuObject);
                    break;
                case 'setVertexBuffer':
                    renderPass.setVertexBuffer(c.args.slot, c.args.buffer.webgpuObject, c.args.offset, c.args.size);
                    break;
                case 'setViewport':
                    renderPass.setViewport(c.args.x, c.args.y, c.args.width, c.args.height, c.args.minDepth, c.args.maxDepth);
                    break;
                default:
                    console.assert("Unhandled command type '" + c.name + "'");
            }
        }
    }
}

class ReplayBuffer extends ReplayObject {
    constructor(replay, desc) {
        super(replay, desc);
        this.device = this.replay.devices[desc.deviceSerial]
        this.usage = desc.usage;
        this.size = desc.size;
        console.assert(desc.state === 'unmapped');

        this.webgpuObject = this.device.webgpuObject.createBuffer({
            usage: desc.usage | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
            size: desc.size,
        });
        if (desc.initialData !== undefined) {
            const data = this.replay.getData(desc.initialData);
            this.device.webgpuObject.queue.writeBuffer(this.webgpuObject, 0, data);
        }
    }
}

class ReplayBindGroup extends ReplayObject {
    constructor(replay, desc) {
        super(replay, desc);
        this.device = this.replay.devices[desc.deviceSerial]
        this.webgpuObject = this.device.webgpuObject.createBindGroup({
            layout: this.replay.bindGroupLayouts[desc.layoutSerial].webgpuObject,
            entries: desc.entries.map(e => {
                const entry = {binding: e.binding};
                if (e.textureViewSerial !== undefined) {
                    entry.resource = this.replay.textureViews[e.textureViewSerial].webgpuObject;
                } else if (e.samplerSerial !== undefined) {
                    entry.resource = this.replay.samplers[e.samplerSerial].webgpuObject;
                } else if (e.bufferSerial !== undefined) {
                    entry.resource = {
                        buffer: this.replay.buffers[e.bufferSerial].webgpuObject,
                        offset: e.offset,
                        size: e.size,
                    };
                }
                return entry;
            }),
        });
    }
}

class ReplayBindGroupLayout extends ReplayObject {
    constructor(replay, desc) {
        super(replay, desc);
        this.device = this.replay.devices[desc.deviceSerial];
        this.webgpuObject = this.device.webgpuObject.createBindGroupLayout(desc);
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

class ReplayPipelineLayout extends ReplayObject {
    constructor(replay, desc) {
        super(replay, desc);
        this.device = this.replay.devices[desc.deviceSerial]
        this.webgpuObject = this.device.webgpuObject.createPipelineLayout({
            bindGroupLayouts: desc.bindGroupLayoutsSerial.map(s => this.replay.bindGroupLayouts[s].webgpuObject),
        });
    }
}

class ReplayQuerySet extends ReplayObject {
    constructor(replay, desc) {
        super(replay, desc);
        this.device = this.replay.devices[desc.deviceSerial];
        this.webgpuObject = this.device.webgpuObject.createQuerySet(desc);
        // TODO how to put the initial data ???
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
        this.device = this.replay.devices[desc.deviceSerial].webgpuObject;
        const vsModule = this.replay.shaderModules[desc.vertex.moduleSerial].webgpuObject;
        const fsModule = this.replay.shaderModules[desc.fragment.moduleSerial].webgpuObject;
        const layout = desc.layout === 'auto' ? 'auto' : this.replay.pipelineLayouts[desc.layoutSerial].webgpuObject;

        // Do this properly and with all state pls.
        const localDesc = {
            label: desc.label,
            layout,
            vertex: {
                module: vsModule,
                ...desc.vertex,
            },
            depthStencil: desc.depthStencil,
            multisample: desc.multisample,
            primitive: desc.primitive,
        };

        if (desc.fragment !== undefined) {
            localDesc.fragment = {
                module: fsModule,
                ...desc.fragment
            };
        }
        this.webgpuObject = await this.device.createRenderPipelineAsync(localDesc);
    }
}

class ReplaySampler extends ReplayObject {
    constructor(replay, desc) {
        super(replay, desc);
        this.device = this.replay.devices[desc.deviceSerial];
        this.webgpuObject = this.device.webgpuObject.createSampler(desc);
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
        this.sampleCount = desc.sampleCount;

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
        this.texture = this.replay.textures[desc.textureSerial];
        this.webgpuObject = this.texture.webgpuObject.createView({
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
