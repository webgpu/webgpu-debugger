import React from 'react';
import { ReplayTexture } from '../../../../replay';
import TextureLevelViewer from '../../../components/TextureLevelViewer/TextureLevelViewer';
import { ValueObject } from '../../../components/Value/Value';

import { getRange } from '../../../lib/array-utils';

export default function TextureVis({ data }: { data: ReplayTexture }) {
    return (
        <div className="spector2-vis">
            <ValueObject data={data} />
            {/* will have to figure out something different for texture arrays */}
            {getRange(data.mipLevelCount).map(mipLevel => (
                <div key={`mip${mipLevel}`}>
                    <div>mipLevel: {mipLevel} </div>
                    <TextureLevelViewer texture={data} mipLevel={mipLevel} />
                </div>
            ))}
        </div>
    );
}
