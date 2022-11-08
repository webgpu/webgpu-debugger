import { roundUpToMultipleOf } from './math-utils';

// TODO: fix better?
export const isTypedArray = (arr: any) =>
    arr && typeof arr.length === 'number' && arr.buffer instanceof ArrayBuffer && typeof arr.byteLength === 'number';

export type TypedArrayConstructor =
    | Int8ArrayConstructor
    | Uint8ArrayConstructor
    | Int16ArrayConstructor
    | Uint16ArrayConstructor
    | Int32ArrayConstructor
    | Uint32ArrayConstructor
    | Float32ArrayConstructor
    | Float64ArrayConstructor;

export type TypedArray =
    | Int8Array
    | Uint8Array
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | Float32Array
    | Float64Array;

export class TypedArrayViewGenerator {
    arrayBuffer: ArrayBuffer;
    byteOffset: number;

    constructor(sizeInBytes: number) {
        this.arrayBuffer = new ArrayBuffer(sizeInBytes);
        this.byteOffset = 0;
    }
    getView<T extends TypedArray>(Ctor: TypedArrayConstructor, numElements: number): T {
        const view = new Ctor(this.arrayBuffer, this.byteOffset, numElements);
        this.byteOffset += view.byteLength;
        return view as T;
    }
    i8(numElements: number): Int8Array {
        return this.getView(Int8Array, numElements);
    }
    u8(numElements: number): Uint8Array {
        return this.getView(Uint8Array, numElements);
    }
    i16(numElements: number): Int16Array {
        return this.getView(Int16Array, numElements);
    }
    u16(numElements: number): Uint16Array {
        return this.getView(Uint16Array, numElements);
    }
    i32(numElements: number): Int32Array {
        return this.getView(Int32Array, numElements);
    }
    u32(numElements: number): Uint32Array {
        return this.getView(Uint32Array, numElements);
    }
    f32(numElements: number): Float32Array {
        return this.getView(Float32Array, numElements);
    }
    f64(numElements: number): Float64Array {
        return this.getView(Float64Array, numElements);
    }
}

type FieldDescription = {
    type: string;
    def?: StructDescription;
    arraySize?: number;
};

type StructDescription = Record<string, FieldDescription>;

type TypeDef = {
    align: number;
    size: number;
    type: string;
    view: TypedArrayConstructor;
};

const typeInfo: Record<string, TypeDef> = {
    i32: { align: 4, size: 4, type: 'i32', view: Int32Array },
    u32: { align: 4, size: 4, type: 'u32', view: Uint32Array },
    f32: { align: 4, size: 4, type: 'f32', view: Float32Array },
    f16: { align: 2, size: 2, type: 'u16', view: Uint16Array },
    'vec2<i32>': { align: 8, size: 8, type: 'i32', view: Int32Array },
    'vec2<u32>': { align: 8, size: 8, type: 'u32', view: Uint32Array },
    'vec2<f32>': { align: 8, size: 8, type: 'f32', view: Float32Array },
    'vec2<f16>': { align: 4, size: 4, type: 'u16', view: Uint16Array },
    'vec3<i32>': { align: 16, size: 16, type: 'i32', view: Int32Array },
    'vec3<u32>': { align: 16, size: 16, type: 'u32', view: Uint32Array },
    'vec3<f32>': { align: 16, size: 16, type: 'f32', view: Float32Array },
    'vec3<f16>': { align: 8, size: 8, type: 'u16', view: Uint16Array },
    'vec4<i32>': { align: 16, size: 16, type: 'i32', view: Int32Array },
    'vec4<u32>': { align: 16, size: 16, type: 'u32', view: Uint32Array },
    'vec4<f32>': { align: 16, size: 16, type: 'f32', view: Float32Array },
    'vec4<f16>': { align: 8, size: 8, type: 'u16', view: Uint16Array },
    // AlignOf(vecR)	SizeOf(array<vecR, C>)
    'mat2x2<f32>': { align: 8, size: 8, type: 'f32', view: Float32Array },
    'mat2x2<f16>': { align: 4, size: 4, type: 'u16', view: Uint16Array },
    'mat3x2<f32>': { align: 8, size: 8, type: 'f32', view: Float32Array },
    'mat3x2<f16>': { align: 4, size: 4, type: 'u16', view: Uint16Array },
    'mat4x2<f32>': { align: 8, size: 8, type: 'f32', view: Float32Array },
    'mat4x2<f16>': { align: 4, size: 4, type: 'u16', view: Uint16Array },
    'mat2x3<f32>': { align: 16, size: 16, type: 'f32', view: Float32Array },
    'mat2x3<f16>': { align: 8, size: 8, type: 'u16', view: Uint16Array },
    'mat3x3<f32>': { align: 16, size: 16, type: 'f32', view: Float32Array },
    'mat3x3<f16>': { align: 8, size: 8, type: 'u16', view: Uint16Array },
    'mat4x3<f32>': { align: 16, size: 16, type: 'f32', view: Float32Array },
    'mat4x3<f16>': { align: 8, size: 8, type: 'u16', view: Uint16Array },
    'mat2x4<f32>': { align: 16, size: 16, type: 'f32', view: Float32Array },
    'mat2x4<f16>': { align: 8, size: 8, type: 'u16', view: Uint16Array },
    'mat3x4<f32>': { align: 16, size: 16, type: 'f32', view: Float32Array },
    'mat3x4<f16>': { align: 8, size: 8, type: 'u16', view: Uint16Array },
    'mat4x4<f32>': { align: 16, size: 16, type: 'f32', view: Float32Array },
    'mat4x4<f16>': { align: 8, size: 8, type: 'u16', view: Uint16Array },
};
/*
struct S with members M1...MN	max(AlignOfMember(S,1), ... , AlignOfMember(S,N))
roundUp(AlignOf(S), justPastLastMember)

where justPastLastMember = OffsetOfMember(S,N) + SizeOfMember(S,N)
array<E, N>
AlignOf(E)	N × roundUp(AlignOf(E), SizeOf(E))
array<E>
AlignOf(E)	Nruntime × roundUp(AlignOf(E),SizeOf(E))

where Nruntime is the runtime-determined number of elements of T
*/

function getAlignSize(type: string, def?: StructDescription) {
    return type === 'struct' ? computeSizeForTypedArrayViews(def) : typeInfo[type];
}

function computeSizeForTypedArrayViews(structDesc: StructDescription) {
    let totalSize = 0;
    let firstAlign = 0;
    for (const [, { type, def, arraySize }] of Object.entries(structDesc)) {
        const { align, size } = getAlignSize(type, def);
        firstAlign = firstAlign || align;
        totalSize += roundUpToMultipleOf(size, align);
        const elementSize = Math.max(align, size);
        totalSize += elementSize * (arraySize || 1);
    }
    return { align: firstAlign, size: totalSize };
}

export function makeTypedArrayViews(structDesc: StructDescription, views = {}) {
    const { size: totalSize } = computeSizeForTypedArrayViews(structDesc);
    const gen = new TypedArrayViewGenerator(totalSize);
    let offset = 0;

    const makeViews = (structDesc: StructDescription) => {
        const views = {};
        for (const [name, { type, def, arraySize }] of Object.entries(structDesc)) {
            const { align, size } = getAlignSize(type, def);
            if (type === 'struct') {
                if (!arraySize) {
                    views[name] = makeViews(def);
                } else {
                    views[name] = new Array(arraySize).fill(0).map(_ => makeViews(def));
                }
            } else {
                const { size, type: viewType, view } = typeInfo[type];
                const numElements = size / view.BYTES_PER_ELEMENT;
                views[name] = gen[viewType](numElements * (arraySize || 1));
            }
            offset += roundUpToMultipleOf(size, align);

            const elementSize = Math.max(align, size);
            totalSize += elementSize * (arraySize || 1);
        }
        return views;
    };
    return makeViews(structDesc);
}
