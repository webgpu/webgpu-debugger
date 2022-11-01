import React from 'react';
import { ReplayTextureView } from '../../../../replay';
import { ValueObject } from '../../../components/Value/Value';

export default function TextureViewVis({ data }: { data: ReplayTextureView }) {
    return (
        <div className="spector2-vis">
            <ValueObject data={data} />
        </div>
    );
}
