import { Replay } from './../replay';

interface ReplayAPI {
    /**
     * Capture a single frame. Should call `addReplay` When done
     */
    captureFrame: () => Promise<void>;

    /**
     * Start capturing frames until `endCapture` is called
     */
    startCapture: () => void;

    /**
     * Stop capturing (see `startCapture`)
     */
    endCapture: () => void;

    /**
     * Request to playback to a specific part of a playback
     * @param replay The replay to replay
     * @param id this is the form of steps -> sub steps -> sub sub steps.
     *
     *   Imagine a replay represents n frames, then [2, 3, 4, 5] would represent
     *     frame[2]
     *       device/queue function[3]  (assume this happens to be queue.submit)
     *         command buffer[4]
     *            command [5]
     *
     */
    playTo: (replay: Replay, id: number[]) => void;

    getBufferData: (buffer: GPUBuffer, offset: number, size: number) => Promise<ArrayBuffer>;
    getTextureData: (
        texture: GPUTexture,
        level: number,
        x: number,
        y: number,
        z: number,
        width: number,
        height: number,
        depth: number
    ) => Promise<ArrayBuffer>;
    getTextureImage: (texture: GPUTexture, level: number) => Promise<ImageBitmap>;
}

export default ReplayAPI;
