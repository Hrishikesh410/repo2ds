import React from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
}

export class Modal extends React.Component<ModalProps> {
  render() {
    if (!this.props.open) {
      return null;
    }
    return (
      <div style={{ padding: 24, borderRadius: 16, backgroundColor: '#FFFFFF' }}>
        <h2 style={{ fontSize: 20, fontWeight: '700' }}>{this.props.title}</h2>
        <button type="button" onClick={this.props.onClose}>
          Close
        </button>
      </div>
    );
  }
}
