import React from 'react';
import { ReplayTexture } from '../../../../replay';
import { TextureLevelViewer } from '../../../components/TextureLevelViewer/TextureLevelViewer';
import { ValueObject } from '../../../components/Value/Value';

function* range(n: number) {
    for (let i = 0; i < n; i++) {
        yield i;
    }
}

const s_ranges: number[][] = [];

function getRange(n: number) {
    if (!s_ranges[n]) {
        s_ranges[n] = new Array(n).fill(0).map((_, i) => i);
    }
    return s_ranges[n];
}

export default function TextureVis({ data }: { data: ReplayTexture }) {
    return (
        <div className="spector2-vis">
            <ValueObject data={data} />
            {/* will have to figure out something different for texture arrays */}
            {getRange(data.mipLevelCount).map(mipLevel => (
                <TextureLevelViewer key={`mip${mipLevel}`} texture={data} mipLevel={mipLevel} />
            ))}
        </div>
    );
}
