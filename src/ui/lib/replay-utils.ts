import { Replay } from '../../replay';

function getLastElementAndPushIndex(arr: any[], path: number[]) {
    const lastNdx = arr.length - 1;
    path.push(lastNdx);
    return arr[lastNdx];
}

export function getPathForLastStep(replay: Replay) {
    const path: number[] = [];
    const lastCmd = getLastElementAndPushIndex(replay.commands, path);
    if (lastCmd.name === 'queueSubmit') {
        const lastCB = getLastElementAndPushIndex(lastCmd.args.commandBuffers, path);
        if (lastCB) {
            const lastCBCmd = getLastElementAndPushIndex(lastCB.commands, path);
            if (lastCBCmd.name === 'renderPass') {
                getLastElementAndPushIndex(lastCBCmd.renderPass.commands, path);
            }
        }
    }
    return path;
}
