type RequestAdapterFn = (options: GPURequestAdapterOptions) => Promise<GPUAdapter>;

let requestUnwrappedAdapter: RequestAdapterFn;

export async function loadReplay(trace, requestUnwrappedAdapterFn: RequestAdapterFn) {
    requestUnwrappedAdapter = requestUnwrappedAdapterFn;
    const replay = new Replay();
    await replay.load(trace);
    return replay;
}

export type CommandArgs = Record<string, any>;

export type Command = {
    name: string;
    args: CommandArgs;
};

export type CommandBuffer = {
    commands: Command[];
};

export type QueueSubmitArgs = {
    commandBuffers: CommandBuffer[];
};

export type RenderPassArgs = {
    commands: Command[];
};

export class Replay {
    commands: Command[] = [];

    constructor() {}

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
        // Initialive the implicit bind group layouts now that all pipelines are created.
        // Luckily implicit layouts can't be used to create pipeline layouts so we don't have circular dependencies.
        for (const i in this.bindGroupLayouts) {
            if (this.bindGroupLayouts[i].implicit) {
                this.bindGroupLayouts[i].initializeFromImplicitDesc();
            }
        }

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
                case 'queueWriteTexture':
                    c.queue = this.queues[c.queueSerial];
                    delete c.queueSerial;
                    c.args.destination.textureState = this.textures[c.args.destination.textureSerial];
                    c.args.destination.texture = c.args.destination.textureState.webgpuObject;
                    delete c.args.destination.textureSerial;
                    break;
                case 'present':
                    c.args.texture = this.textures[c.args.textureSerial];
                    delete c.args.textureSerial;
                    break;
                case 'textureDestroy':
                    c.texture = this.textures[c.textureSerial];
                    delete c.textureSerial;
                    break;
                case 'bufferUpdateData':
                case 'bufferUnmap':
                    c.buffer = this.buffers[c.bufferSerial];
                    delete c.bufferSerial;
                    break;
                default:
                    console.assert(false, `Unhandled command type '${c.name}'`);
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

            case 'queueWriteBuffer': {
                const dataBuf = this.getData(command.args.data);
                command.queue.webgpuObject.writeBuffer(
                    command.args.buffer.webgpuObject,
                    command.args.bufferOffset,
                    dataBuf
                );
                break;
            }

            case 'queueWriteTexture': {
                const dataBuf = this.getData(command.args.data);
                command.queue.webgpuObject.writeTexture(
                    command.args.destination,
                    dataBuf,
                    { ...command.args.dataLayout, offset: 0 },
                    command.args.size
                );
                break;
            }

            case 'present':
                // Nothing to do?
                this.state = { currentTexture: command.args.texture }; // TOOD: hack-remove
                break;

            case 'textureDestroy':
                // Do nothing so as to not invalidate replay state.
                break;

            default:
                console.assert(false, `Unhandled command type '${c.name}'`);
        }
    }

    *iterateCommands() {
        // Return index, command
        for (let i = 0; i < this.commands.length; i++) {
            const c = this.commands[i];
            switch (c.name) {
                case 'queueWriteBuffer':
                case 'queueWriteTexture':
                case 'present':
                case 'textureDestroy':
                case 'bufferUpdateData':
                case 'bufferUnmap':
                    yield { path: [i], command: c };
                    break;

                case 'queueSubmit':
                    for (let j = 0; j < c.args.commandBuffers.length; j++) {
                        yield* c.args.commandBuffers[j].iterateCommands([i, j]);
                    }
                    break;

                default:
                    console.assert(false, `Unhandled command type '${c.name}'`);
            }
        }
    }

    endPath() {
        return [this.commands.length];
    }

    async replayTo(path) {
        this.state = {}; // TODO: hack, remove
        // TODO resetState
        path = path.slice();
        const replayLevel = path.shift();
        for (let i = 0; i <= replayLevel; i++) {
            const c = this.commands[i];
            if (c.name === 'queueSubmit') {
                if (i === replayLevel) {
                    c.queue.replaySubmitTo(path, c.args.commandBuffers);
                } else {
                    c.queue.executeSubmit(c.args.commandBuffers);
                }
            } else {
                // TODO fold executeCommand here.
                this.execute(c);
            }
        }
        return this.state; // TODO: hack, remove
    }

    getState() {
        return this.state;
    }
}

class ReplayObject {
    constructor(replay, desc) {
        this.replay = replay;
        this.label = desc.label ?? '';
    }
}

export class ReplayAdapter extends ReplayObject {
    constructor(replay, desc) {
        super(replay, desc);
    }

    async recreate(desc) {
        this.webgpuObject = await requestUnwrappedAdapter(desc);
    }
}

export class ReplayRenderPass extends ReplayObject {
    constructor(replay, desc) {
        super(replay, desc);
        this.commands = [];
    }

    consumeCommands(beginRenderPassCommand, commandIterator) {
        console.assert(this.commands.length === 0);
        this.commands.push(beginRenderPassCommand);

        for (const command of commandIterator) {
            const c = window.structuredClone(command);
            switch (c.name) {
                case 'endPass':
                    this.state = {}; // TODO: hack, remove
                    this.commands.push(c);
                    return;

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
                case 'draw':
                case 'drawIndexed':
                    break;
                case 'setViewport':
                case 'pushDebugGroup':
                case 'popDebugGroup':
                    break;
                default:
                    console.assert(false, `Unhandled render pass command type '${c.name}'`);
            }
            this.commands.push(c);
        }

        console.assert(false, `BeginRenderPass command doesn't have an associated EndPass.`);
    }

    encodeIn(encoder) {
        this.encodeUpTo([this.commands.length - 1], encoder);
    }

    encodeUpTo(path, encoder) {
        const commandIndex = path.shift();
        if (commandIndex === 0) {
            return;
        }

        console.assert(this.commands[0].name === 'beginRenderPass');
        console.assert(this.commands[this.commands.length - 1].name === 'endPass');

        const renderPassDesc = this.commands[0].args;
        const renderPass = encoder.beginRenderPass(renderPassDesc);
        let renderPassEnded = false;

        if (commandIndex !== this.commands.length) {
            for (const a of renderPassDesc.colorAttachments ?? []) {
                if (a.storeOp === 'discard') {
                    console.warning("Don't know how to turn discard into stores yet");
                }
            }
            const ds = renderPassDesc.depthStencilAttachment;
            if (ds) {
                if (ds.stencilStoreOp === 'discard' || ds.depthStoreOp === 'discard') {
                    console.warning("Don't know how to turn discard into stores yet");
                }
            }
        }

        console.assert(
            renderPassDesc.colorAttachments[0]?.viewState,
            'Computing render pass size currently requires the first color attachment to always be set.'
        );
        const firstAttachment = renderPassDesc.colorAttachments[0].viewState;
        console.assert(firstAttachment.baseMipLevel === 0);
        const state = {
            viewport: {
                x: 0,
                y: 0,
                width: firstAttachment.texture.size.width,
                height: firstAttachment.texture.size.height,
                minDepth: 0.0,
                maxDepth: 1.0,
            },
            colorAttachments: renderPassDesc.colorAttachments.map(a => {
                return { view: a.viewState, resolveTarget: a.resolveTargetState };
            }),
            depthStencilAttachment: { view: renderPassDesc.depthStencilAttachment?.viewState },
            pipeline: null,
            bindGroups: [],
            vertexBuffers: [],
            indexBuffer: { buffer: null, offset: 0, size: 0 },
        };

        // HAAAAACK
        const a = renderPassDesc.colorAttachments[0];
        if (a.resolveTarget) {
            this.replay.textureStateToShow = a.resolveTargetState.texture;
        } else {
            this.replay.textureStateToShow = a.viewState.texture;
        }

        for (let i = 1; i <= commandIndex; i++) {
            const c = this.commands[i];
            switch (c.name) {
                case 'draw':
                    renderPass.draw(c.args.vertexCount, c.args.instanceCount, c.args.firstVertex, c.args.firstInstance);
                    break;
                case 'drawIndexed':
                    renderPass.drawIndexed(
                        c.args.indexCount,
                        c.args.instanceCount,
                        c.args.firstIndex,
                        c.args.baseVertex,
                        c.args.firstInstance
                    );
                    break;
                case 'endPass':
                    renderPass.end();
                    renderPassEnded = true;
                    break;
                case 'popDebugGroup':
                    renderPass.popDebugGroup();
                    break;
                case 'pushDebugGroup':
                    renderPass.pushDebugGroup(c.args.groupLabel);
                    break;
                case 'setBindGroup':
                    renderPass.setBindGroup(c.args.index, c.args.bindGroup.webgpuObject, c.dynamicOffsets);
                    state.bindGroups[c.args.index] = { group: c.args.bindGroup, dynamicOffsets: c.dynamicOffsets };
                    break;
                case 'setIndexBuffer':
                    renderPass.setIndexBuffer(
                        c.args.buffer.webgpuObject,
                        c.args.indexFormat,
                        c.args.offset,
                        c.args.size
                    );
                    state.indexBuffer = { buffer: c.args.buffer, offset: c.args.offset, size: c.args.size };
                    break;
                case 'setPipeline':
                    renderPass.setPipeline(c.args.pipeline.webgpuObject);
                    state.pipeline = c.args.pipeline;
                    break;
                case 'setVertexBuffer':
                    renderPass.setVertexBuffer(c.args.slot, c.args.buffer.webgpuObject, c.args.offset, c.args.size);
                    state.vertexBuffers[c.args.slot] = {
                        buffer: c.args.buffer,
                        offset: c.args.offset,
                        size: c.args.size,
                    };
                    break;
                case 'setViewport':
                    renderPass.setViewport(
                        c.args.x,
                        c.args.y,
                        c.args.width,
                        c.args.height,
                        c.args.minDepth,
                        c.args.maxDepth
                    );
                    state.viewport = { ...c.args };
                    break;
                default:
                    console.assert(false, `Unhandled render pass command type '${c.name}'`);
            }
        }

        if (!renderPassEnded) {
            this.replay.state = state;
            renderPass.end();
        }
    }

    *iterateCommands([i, j, k]) {
        for (let l = 0; l < this.commands.length; l++) {
            const c = this.commands[l];
            switch (c.name) {
                case 'beginRenderPass':
                case 'copyBufferToTexture':
                case 'copyTextureToTexture':
                case 'draw':
                case 'drawIndexed':
                case 'endPass':
                case 'popDebugGroup':
                case 'pushDebugGroup':
                case 'setBindGroup':
                case 'setIndexBuffer':
                case 'setPipeline':
                case 'setVertexBuffer':
                case 'setViewport':
                    yield { path: [i, j, k, l], command: c };
                    break;
                default:
                    console.assert(false, `Unhandled render pass command type '${c.name}'`);
            }
        }
    }
}

export class ReplayCommandBuffer extends ReplayObject {
    constructor(replay, desc) {
        super(replay, desc);
        this.commands = [];

        const commandIterator = desc.commands.values();
        this.consumeCommands(commandIterator);
        console.assert(commandIterator.next().done);
    }

    consumeCommands(commandIterator) {
        console.assert(this.commands.length === 0);

        for (const command of commandIterator) {
            const c = window.structuredClone(command);
            switch (c.name) {
                case 'beginRenderPass': {
                    this.state = { currentRenderPassDescriptor: c.args }; // TODO: hack, remove
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

                    // Special case, add a pseudo-command that's a whole render pass command.
                    const rp = new ReplayRenderPass(this.replay, c.args);
                    rp.consumeCommands(c, commandIterator);
                    this.commands.push({ name: 'renderPass', renderPass: rp });
                    continue;
                }
                case 'copyBufferToTexture':
                    c.args.source.bufferState = this.replay.buffers[c.args.source.bufferSerial];
                    c.args.source.buffer = c.args.source.bufferState.webgpuObject;
                    delete c.args.source.buffer;
                    c.args.destination.textureState = this.replay.textures[c.args.destination.textureSerial];
                    c.args.destination.texture = c.args.destination.textureState.webgpuObject;
                    delete c.args.destination.texture;
                    break;
                case 'copyTextureToTexture':
                    c.args.source.textureState = this.replay.textures[c.args.source.textureSerial];
                    c.args.source.texture = c.args.source.textureState.webgpuObject;
                    delete c.args.source.texture;
                    c.args.destination.textureState = this.replay.textures[c.args.destination.textureSerial];
                    c.args.destination.texture = c.args.destination.textureState.webgpuObject;
                    delete c.args.destination.texture;
                    break;
                case 'pushDebugGroup':
                case 'popDebugGroup':
                    break;
                default:
                    console.assert(false, `Unhandled command encoder command '${c.name}'`);
            }
            this.commands.push(c);
        }
    }

    encodeIn(encoder) {
        this.encodeUpTo([this.commands.length - 1], encoder, true);
    }

    encodeUpTo(path, encoder, full = false) {
        const commandIndex = path.shift();
        for (let i = 0; i <= commandIndex; i++) {
            const c = this.commands[i];
            switch (c.name) {
                case 'renderPass':
                    if (i === commandIndex && !full) {
                        c.renderPass.encodeUpTo(path, encoder);
                    } else {
                        c.renderPass.encodeIn(encoder);
                    }
                    break;
                case 'copyBufferToTexture':
                    encoder.copyBufferToTexture(c.args.source, c.args.destination, c.args.copySize);
                    break;
                case 'copyTextureToTexture':
                    encoder.copyTextureToTexture(c.args.source, c.args.destination, c.args.copySize);
                    break;
                case 'popDebugGroup':
                    encoder.popDebugGroup();
                    break;
                case 'pushDebugGroup':
                    encoder.pushDebugGroup(c.args.groupLabel);
                    break;
                default:
                    console.assert(false, `Unhandled command encoder command type '${c.name}'`);
            }
        }
    }

    *iterateCommands([i, j]) {
        for (let k = 0; k < this.commands.length; k++) {
            const c = this.commands[k];
            switch (c.name) {
                case 'renderPass':
                    yield* c.renderPass.iterateCommands([i, j, k]);
                    break;

                case 'copyBufferToTexture':
                case 'copyTextureToTexture':
                case 'popDebugGroup':
                case 'pushDebugGroup':
                    yield { path: [i, j, k], command: c };
                    break;
                default:
                    console.assert(false, `Unhandled command encoder command type '${c.name}'`);
            }
        }
    }
}

export class ReplayBuffer extends ReplayObject {
    constructor(replay, desc) {
        super(replay, desc);
        this.device = this.replay.devices[desc.deviceSerial];
        this.usage = desc.usage;
        this.size = desc.size;
        console.assert(desc.state === 'unmapped' || desc.state === 'mapped-at-creation');

        this.webgpuObject = this.device.webgpuObject.createBuffer({
            usage: desc.usage | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
            size: desc.size,
            mappedAtCreation: desc.state === 'mapped-at-creation',
        });
        if (desc.initialData !== undefined) {
            const data = this.replay.getData(desc.initialData);
            this.device.webgpuObject.queue.writeBuffer(this.webgpuObject, 0, data);
        }
    }
}

export class ReplayBindGroup extends ReplayObject {
    constructor(replay, desc) {
        super(replay, desc);
        this.device = this.replay.devices[desc.deviceSerial];

        this.webgpuObject = this.device.webgpuObject.createBindGroup({
            layout: this.replay.bindGroupLayouts[desc.layoutSerial].webgpuObject,
            entries: desc.entries.map(e => {
                const entry = { binding: e.binding };
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

export class ReplayBindGroupLayout extends ReplayObject {
    constructor(replay, desc) {
        super(replay, desc);
        this.device = this.replay.devices[desc.deviceSerial];
        this.desc = window.structuredClone(desc);

        this.implicit = desc.entries === undefined;
        if (this.implicit) {
            return;
        }

        this.webgpuObject = this.device.webgpuObject.createBindGroupLayout(desc);
    }

    initializeFromImplicitDesc() {
        const pipeline = this.replay.renderPipelines[this.desc.renderPipelineSerial];
        this.webgpuObject = pipeline.webgpuObject.getBindGroupLayout(this.desc.groupIndex);
    }
}

export class ReplayDevice extends ReplayObject {
    constructor(replay, desc) {
        super(replay, desc);
    }

    async recreate(desc) {
        const adapter = this.replay.adapters[desc.adapterSerial].webgpuObject;
        this.webgpuObject = await adapter.requestDevice();
    }
}

export class ReplayPipelineLayout extends ReplayObject {
    constructor(replay, desc) {
        super(replay, desc);
        this.device = this.replay.devices[desc.deviceSerial];
        this.webgpuObject = this.device.webgpuObject.createPipelineLayout({
            bindGroupLayouts: desc.bindGroupLayoutsSerial.map(s => this.replay.bindGroupLayouts[s].webgpuObject),
        });
    }
}

export class ReplayQuerySet extends ReplayObject {
    constructor(replay, desc) {
        super(replay, desc);
        this.device = this.replay.devices[desc.deviceSerial];
        this.webgpuObject = this.device.webgpuObject.createQuerySet(desc);
        // TODO how to put the initial data ???
    }
}

export class ReplayQueue extends ReplayObject {
    constructor(replay, desc) {
        super(replay, desc);
        this.device = this.replay.devices[desc.deviceSerial];
        this.webgpuObject = this.device.webgpuObject.queue;
    }

    executeSubmit(commandBuffers) {
        const encoder = this.device.webgpuObject.createCommandEncoder();
        for (const commandBuffer of commandBuffers) {
            commandBuffer.encodeIn(encoder);
        }
        this.webgpuObject.submit([encoder.finish()]);
    }

    replaySubmitTo(path, commandBuffers) {
        const commandBufferIndex = path.shift();
        const encoder = this.device.webgpuObject.createCommandEncoder();
        for (let i = 0; i < commandBufferIndex - 1; i++) {
            commandBuffers[i].encodeIn(encoder);
        }
        commandBuffers[commandBufferIndex].encodeUpTo(path, encoder);
        this.webgpuObject.submit([encoder.finish()]);
    }
}

export class ReplayRenderPipeline extends ReplayObject {
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
                ...desc.fragment,
            };
        }
        this.webgpuObject = await this.device.createRenderPipelineAsync(localDesc);
    }
}

export class ReplaySampler extends ReplayObject {
    constructor(replay, desc) {
        super(replay, desc);
        this.device = this.replay.devices[desc.deviceSerial];
        this.webgpuObject = this.device.webgpuObject.createSampler(desc);
    }
}

export class ReplayShaderModule extends ReplayObject {
    constructor(replay, desc) {
        super(replay, desc);
        const device = this.replay.devices[desc.deviceSerial];
        this.webgpuObject = device.webgpuObject.createShaderModule({
            code: desc.code,
        });
    }
}

export class ReplayTexture extends ReplayObject {
    constructor(replay, desc) {
        super(replay, desc);
        this.device = this.replay.devices[desc.deviceSerial];
        this.size = desc.size;
        this.format = desc.format;
        this.sampleCount = desc.sampleCount;
        this.mipLevelCount = desc.mipLevelCount;
        this.dimension = desc.dimension;

        this.webgpuObject = this.device.webgpuObject.createTexture({
            format: this.format,
            usage: desc.usage | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
            size: this.size,
            dimension: desc.dimension,
            mipLevelCount: desc.mipLevelCount,
            sampleCount: desc.sampleCount,
            viewFormats: desc.viewFormats,
        });

        if (desc.initialData !== undefined) {
            this.loadInitialData(desc.initialData);
        } else if (desc.state === 'destroyed') {
            this.webgpuObject.destroy();
        }
    }

    loadInitialData(initialData) {
        if (this.sampleCount !== 1) {
            console.warn('No support for sampleCount > 1 texture initial data.');
            return;
        }
        if (this.dimension !== '2d') {
            console.warn("No support for dimension != '2d' texture initial data.");
            return;
        }
        //if (kTextureFormatInfo[this.format].type !== 'color') {
        //    console.warn('No support for non-color texture initial data.');
        //    return result;
        //}

        for (const subresource of initialData) {
            const data = this.replay.getData(subresource.data);
            const mip = subresource.mipLevel;
            const width = Math.max(1, this.size.width >> mip);
            const height = Math.max(1, this.size.height >> mip);
            const depthOrArrayLayers = this.size.depthOrArrayLayers; // TODO support 3D.

            this.device.webgpuObject.queue.writeTexture(
                {
                    texture: this.webgpuObject,
                    mipLevel: mip,
                },
                data,
                { bytesPerRow: subresource.bytesPerRow, rowsPerImage: height },
                { width, height, depthOrArrayLayers }
            );
        }
    }
}

export class ReplayTextureView extends ReplayObject {
    constructor(replay, desc) {
        super(replay, desc);
        this.texture = this.replay.textures[desc.textureSerial];
        this.baseMipLevel = desc.baseMipLevel ?? 0;
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
