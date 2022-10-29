import { Replay } from '../replay';
import ReplayAPI from './ReplayAPI';

interface DebuggerAPI {
    /**
     * Register commands to interface with replay
     */
    registerAPI: (api: ReplayAPI) => void;

    /**
     * Adds a replay to the UI
     */
    addReplay: (replay: Replay) => void;

    /**
     * Pass a canvas of the playback result
     */
    setResult: (canvas: HTMLCanvasElement) => void;
}

export default DebuggerAPI;
