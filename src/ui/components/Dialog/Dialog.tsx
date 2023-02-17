import React from 'react';
import './Dialog.css';

interface Props {
    title: string;
    onClose: () => void;
}

export default class Dialog extends React.Component<React.PropsWithChildren<Props>> {
    componentDidMount() {
        window.addEventListener('keydown', this.handleKeyDown);
    }
    componentWillUnmount() {
        window.removeEventListener('keydown', this.handleKeyDown);
    }
    handleKeyDown = (e: KeyboardEvent) => {
        if (e.keyCode === 27) {
            this.props.onClose();
        }
    };
    render() {
        const { title, children, onClose } = this.props;
        return (
            <div onClick={onClose} className="wgdb-full-size wgdb-dialog">
                <div
                    tabIndex={-1}
                    onClick={e => {
                        e.stopPropagation();
                    }}
                >
                    <div className="wgdb-dialog-heading">
                        <div className="wgdb-dialog-title">{title}</div>
                        <div className="wgdb-dialog-close">
                            <button onClick={onClose}>X</button>
                        </div>
                    </div>
                    <div className="wgdb-dialog-content">{children}</div>
                </div>
            </div>
        );
    }
}
