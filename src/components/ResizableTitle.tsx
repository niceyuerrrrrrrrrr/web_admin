import React, { useState } from 'react'
import { Resizable } from 'react-resizable'
import 'react-resizable/css/styles.css'
import '../styles/resizable-table.css'

interface ResizableTitleProps {
  width: number
  onResize: (e: React.SyntheticEvent, data: { size: { width: number } }) => void
  children?: React.ReactNode
  [key: string]: any
}

const ResizableTitle: React.FC<ResizableTitleProps> = (props) => {
  const { onResize, width, ...restProps } = props
  const [isResizing, setIsResizing] = useState(false)

  if (!width) {
    return <th {...restProps} />
  }

  const handleResizeStart = () => {
    setIsResizing(true)
    document.body.classList.add('resizing-cursor')
  }

  const handleResizeStop = () => {
    setIsResizing(false)
    document.body.classList.remove('resizing-cursor')
  }

  const handleResize = (e: React.SyntheticEvent, data: { size: { width: number } }) => {
    onResize(e, data)
  }

  return (
    <Resizable
      width={width}
      height={0}
      handle={
        <span
          className={`react-resizable-handle ${isResizing ? 'react-resizable-handle-dragging' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
          }}
          onMouseDown={(e) => {
            e.stopPropagation()
          }}
        />
      }
      onResize={handleResize}
      onResizeStart={handleResizeStart}
      onResizeStop={handleResizeStop}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th
        {...restProps}
        className={[restProps.className, isResizing ? 'resizing-column' : ''].filter(Boolean).join(' ')}
      />
    </Resizable>
  )
}

export default ResizableTitle
