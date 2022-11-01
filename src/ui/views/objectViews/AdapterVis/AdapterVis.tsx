import React from 'react';
import { ReplayAdapter } from '../../../../replay';
import { ValueObject } from '../../../components/Value/Value';

export default function AdapterVis({ data }: { data: ReplayAdapter }) {
    return (
        <div className="spector2-vis">
            <ValueObject data={data} />
        </div>
    );
}
