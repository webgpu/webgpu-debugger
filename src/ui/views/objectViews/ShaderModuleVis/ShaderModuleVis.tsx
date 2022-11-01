import React from 'react';
import { ReplayShaderModule } from '../../../../replay';
import { ValueObject } from '../../../components/Value/Value';

export default function ShaderModuleVis({ data }: { data: ReplayShaderModule }) {
    return (
        <div className="spector2-vis">
            <ValueObject data={data} />
        </div>
    );
}
