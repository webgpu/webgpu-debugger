import { describe, it } from '../mocha-support.js';
import { makeTypedArrayViews } from '../../src/ui/lib/typedarray-utils.js';
import { assertEqual, assertTruthy } from '../assert.js';

describe('webgpu-utils-tests', () => {
    it('test builds typedarray views', () => {
        const vertexDesc = {
            offset: { type: 'u32' },
            stride: { type: 'u32' },
            size: { type: 'u32' },
            padding: { type: 'u32' },
        };

        const lineInfo = {
            triDiv: { type: 'u32' },
            triMul: { type: 'u32' },
            midMod: { type: 'u32' },
            midDiv: { type: 'u32' },
            oddMod: { type: 'u32' },
            triMod: { type: 'u32' },
            pad0: { type: 'u32' },
            pad1: { type: 'u32' },
        };

        const uniformDesc = {
            worldViewProjection: {
                type: 'mat4x4<f32>',
            },
            position: {
                type: 'struct',
                def: vertexDesc,
            },
            lineInfo: {
                type: 'struct',
                def: lineInfo,
            },
            color: {
                type: 'vec4<f32>',
            },
            lightDirection: {
                type: 'vec3<f32>',
            },
        };

        const views = makeTypedArrayViews(uniformDesc);
        const arrayBuffer = views.worldViewProjection.buffer;
        assertEqual(arrayBuffer.byteLength, (16 + 4 + 8 + 4 + 3) * 4);

        assertTruthy(views.worldViewProjection instanceof Float32Array);
        assertEqual(views.worldViewProjection.length, 16);
        assertEqual(views.worldViewProjection.byteOffset, 0);

        assertTruthy(views.lightDirection instanceof Float32Array);
        assertEqual(views.lightDirection.length, 3);
        assertEqual(views.lightDirection.byteOffset, (16 + 4 + 8 + 4) * 4);
    });
});
