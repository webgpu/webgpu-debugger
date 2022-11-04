/**
 * This is needed because FlexLayout gets errors (circular dependencies)
 * and I could not figure out a way to suppress them.
 *
 * If you know how, please make a pull request! 🙏
 *
 * It works by building, capturing stderr, and checking for things that look
 * like errors.
 */
import child_process from 'child_process';
import process from 'process';

export function execFile(exe, args) {
    return new Promise((resolve, reject) => {
        child_process.execFile(
            exe,
            args,
            {
                windowsHide: true,
            },
            (error, stdout, stderr) => {
                if (error) {
                    reject({ error, stdout, stderr });
                } else {
                    resolve({ stdout, stderr });
                }
            }
        );
    });
}

export function execFileWithLiveOutput(exe, args) {
    return new Promise((resolve, reject) => {
        const proc = child_process.execFile(
            exe,
            args,
            {
                //    const proc = child_process.fork(exe, args, {
                windowsHide: true,
                env: {
                    ...process.env,
                    ELECTRON_RUN_AS_NODE: 'true',
                },
            },
            (error, stdout, stderr) => {
                if (error) {
                    reject({ error, stdout, stderr });
                } else {
                    resolve({ stdout, stderr });
                }
            }
        );
        if (proc.stdout) {
            proc.stdout.on('data', data => {
                console.log(data);
            });
            proc.stderr.on('data', data => {
                console.error(data);
            });
        }
    });
}

async function main() {
    let success = false;
    try {
        const { stderr } = await execFileWithLiveOutput('./node_modules/.bin/rollup', ['-c']);
        success = !/\.tsx{0,1}: \(\d+:\d+\)/.test(stderr);
    } catch ({ stdout, stderr, error }) {
        //
    }

    if (!success) {
        throw new Error('failed to build without errors');
    }
}

main();
