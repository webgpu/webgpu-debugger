import React from 'react';
import { ReplayTexture } from '../../../../replay';
import TextureLevelViewer from '../../../components/TextureLevelViewer/TextureLevelViewer';
import { ValueObject } from '../../../components/Value/Value';

export default function TextureVis({ data }: { data: ReplayTexture }) {
    return (
        <div className="spector2-vis">
            <ValueObject data={data} />
            <TextureLevelViewer texture={data} />
        </div>
    );
}
