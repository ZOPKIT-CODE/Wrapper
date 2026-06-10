'use client'

import { useCallback, useMemo, useEffect, useState } from 'react'
import ReactFlow, {
  Background,
  useReactFlow,
  ReactFlowProvider,
  type Edge,
  BackgroundVariant,
  type NodeTypes,
  MarkerType,
  Controls,
  MiniMap,
  Panel,
} from 'reactflow'
import 'reactflow/dist/style.css'
import {
  Building,
  Loader2,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OrganizationNode } from './OrganizationNode'
import type { OrganizationHierarchy } from '@/types/organization'
import { CreditAllocationModal } from '@/components/common/CreditAllocationModal'

// Define nodeTypes
const nodeTypes: NodeTypes = {
  organizationNode: OrganizationNode,
}

interface OrganizationHierarchyFlowProps {
  hierarchy: OrganizationHierarchy | null
  loading: boolean
  onRefresh?: () => void
  isAdmin?: boolean
  tenantId?: string
  tenantName?: string
  onNodeClick?: (nodeId: string) => void
  onEditOrganization?: (orgId: string) => void
  onDeleteOrganization?: (orgId: string) => void
  onAddSubOrganization?: (parentId: string) => void
  onAddLocation?: (parentId: string) => void
  onTransferCredits?: (orgId: string) => void
}

// Convert hierarchy tree to React Flow nodes and edges with proper hierarchical layout
function convertHierarchyToFlow(
  hierarchy: OrganizationHierarchy | null,
  _tenantId?: string,
  _tenantName?: string,
  onNodeClick?: (nodeId: string) => void,
  onEditOrganization?: (orgId: string) => void,
  onDeleteOrganization?: (orgId: string) => void,
  onAddSubOrganization?: (parentId: string) => void,
  onAddLocation?: (parentId: string) => void,
  onAllocateCredits?: (entityId: string) => void,
  onTransferCredits?: (orgId: string) => void
) {
  const nodes: any[] = []
  const edges: Edge[] = []
  const nodeMap = new Map<string, any>()

  // Layout configuration - optimized spacing for better alignment
  const NODE_WIDTH = 280
  const NODE_HEIGHT = 180
  const HORIZONTAL_SPACING = 350 // Spacing between root hierarchies
  const VERTICAL_SPACING = 220 // Vertical spacing between levels
  const ROOT_Y = 100
  const MIN_SIBLING_DISTANCE = 80 // Compact spacing between sibling nodes (padding between nodes)

  // If no hierarchy, return empty
  if (!hierarchy || !hierarchy.hierarchy || hierarchy.hierarchy.length === 0) {
    return { nodes, edges }
  }

  // First pass: Calculate subtree widths and positions
  interface NodeLayout {
    x: number
    y: number
    subtreeWidth: number
    subtreeLeft: number
    subtreeRight: number
  }

  const layouts = new Map<string, NodeLayout>()

  // Calculate subtree width recursively (bottom-up)
  function calculateSubtreeLayout(
    org: any,
    level: number
  ): { width: number; left: number; right: number } {
    const nodeId = org.entityId || org.organizationId
    const children = org.children || []

    if (children.length === 0) {
      // Leaf node - use node width centered
      const layout = {
        width: NODE_WIDTH,
        left: -NODE_WIDTH / 2,
        right: NODE_WIDTH / 2,
      }
      layouts.set(nodeId, {
        x: 0,
        y: ROOT_Y + level * VERTICAL_SPACING,
        subtreeWidth: layout.width,
        subtreeLeft: layout.left,
        subtreeRight: layout.right,
      })
      return layout
    }

    // Calculate layout for all children
    const childLayouts = children.map((child: any) =>
      calculateSubtreeLayout(child, level + 1)
    )

    // Calculate total width needed for children
    let totalChildrenWidth = 0
    childLayouts.forEach(
      (layout: { width: number; left: number; right: number }) => {
        totalChildrenWidth += layout.width
      }
    )

    // Add compact spacing between children (not full subtree width)
    // Use MIN_SIBLING_DISTANCE as padding between nodes, not between subtree boundaries
    const spacing =
      children.length > 1 ? (children.length - 1) * MIN_SIBLING_DISTANCE : 0
    const totalWidth = Math.max(NODE_WIDTH, totalChildrenWidth + spacing)

    // Calculate left and right boundaries
    const left = -totalWidth / 2
    const right = totalWidth / 2

    layouts.set(nodeId, {
      x: 0, // Will be set in second pass
      y: ROOT_Y + level * VERTICAL_SPACING,
      subtreeWidth: totalWidth,
      subtreeLeft: left,
      subtreeRight: right,
    })

    return { width: totalWidth, left, right }
  }

  // Second pass: Assign actual x positions (top-down)
  function assignPositions(org: any, parentX: number, level: number): void {
    const nodeId = org.entityId || org.organizationId
    const children = org.children || []
    const layout = layouts.get(nodeId)!

    if (children.length === 0) {
      // Leaf node - position at parent's x (will be adjusted if parent has siblings)
      layout.x = parentX
    } else {
      // Calculate starting position for children
      let currentX = parentX - layout.subtreeWidth / 2

      // Position children first with compact spacing
      children.forEach((child: any, index: number) => {
        const childLayout = layouts.get(child.entityId || child.organizationId)!
        const childSubtreeWidth = childLayout.subtreeWidth

        // Position child at the center of its allocated space
        const childX = currentX + childSubtreeWidth / 2
        childLayout.x = childX

        // Recursively position child's descendants
        assignPositions(child, childX, level + 1)

        // Move to next child position with compact spacing
        currentX += childSubtreeWidth
        if (index < children.length - 1) {
          currentX += MIN_SIBLING_DISTANCE // Compact spacing between siblings
        }
      })

      // Center parent above its children
      const firstChildLayout = layouts.get(
        children[0].entityId || children[0].organizationId
      )!
      const lastChildLayout = layouts.get(
        children[children.length - 1].entityId ||
          children[children.length - 1].organizationId
      )!
      const childrenCenterX = (firstChildLayout.x + lastChildLayout.x) / 2
      layout.x = childrenCenterX
    }
  }

  // Calculate layouts for all root nodes (starting from primary organizations)
  let rootXOffset = 0
  hierarchy.hierarchy.forEach((org: any, index: number) => {
    const layout = calculateSubtreeLayout(org, 0) // Level 0 (root level)
    const nodeId = org.entityId || org.organizationId
    const nodeLayout = layouts.get(nodeId)!

    // Position root node at the center of its subtree
    nodeLayout.x = rootXOffset + layout.width / 2
    assignPositions(org, nodeLayout.x, 0) // Level 0

    // Move to next root position with appropriate spacing
    rootXOffset += layout.width
    if (index < hierarchy.hierarchy.length - 1) {
      rootXOffset += HORIZONTAL_SPACING // Spacing between root hierarchies
    }
  })

  // No tenant node created - start from primary organizations

  // Create nodes and edges
  function createNodesAndEdges(
    org: any,
    parentId: string | null,
    onAllocateCredits?: (entityId: string) => void,
    onTransferCreditsCallback?: (orgId: string) => void
  ): void {
    const nodeId = org.entityId || org.organizationId
    const nodeName = org.entityName || org.organizationName
    const entityType = org.entityType || 'organization'
    const isLocation = entityType === 'location'
    const layout = layouts.get(nodeId)!

    // Create node
    const node = {
      id: nodeId,
      type: 'organizationNode',
      position: { x: layout.x, y: layout.y },
      data: {
        id: nodeId,
        name: nodeName,
        entityType,
        organizationType: org.organizationType,
        locationType: org.locationType,
        isActive: org.isActive !== false,
        description: org.description,
        availableCredits:
          org.availableCredits !== undefined && org.availableCredits !== null
            ? typeof org.availableCredits === 'string'
              ? parseFloat(org.availableCredits) || 0
              : org.availableCredits
            : undefined,
        reservedCredits:
          org.reservedCredits !== undefined && org.reservedCredits !== null
            ? typeof org.reservedCredits === 'string'
              ? parseFloat(org.reservedCredits) || 0
              : org.reservedCredits
            : undefined,
        entityLevel: org.entityLevel || org.organizationLevel || 0,
        isPrimaryOrganization: !parentId && entityType !== 'location',
        onNodeClick,
        onEditOrganization,
        onDeleteOrganization,
        onAddSubOrganization,
        onAddLocation,
        onAllocateCredits,
        onTransferCredits: onTransferCreditsCallback,
      },
      style: {
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      },
      draggable: true,
    }

    nodes.push(node)
    nodeMap.set(nodeId, node)

    // Create edge from parent
    if (parentId && nodeMap.has(parentId)) {
      edges.push({
        id: `${parentId}-${nodeId}`,
        source: parentId,
        target: nodeId,
        type: 'smoothstep',
        animated: false,
        style: {
          stroke: isLocation ? '#f59e0b' : '#1B2E5A',
          strokeWidth: 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isLocation ? '#f59e0b' : '#1B2E5A',
        },
      })
    }

    // Process children
    const children = org.children || []
    children.forEach((child: any) => {
      createNodesAndEdges(
        child,
        nodeId,
        onAllocateCredits,
        onTransferCreditsCallback
      )
    })
  }

  // Create all nodes and edges, starting from primary organizations
  hierarchy.hierarchy.forEach((org: any) => {
    createNodesAndEdges(org, null, onAllocateCredits, onTransferCredits)
  })

  // Center all nodes horizontally
  if (nodes.length > 0) {
    const minX = Math.min(...nodes.map((n) => n.position.x))
    const maxX = Math.max(...nodes.map((n) => n.position.x))
    const centerX = (minX + maxX) / 2
    const offsetX = -centerX

    nodes.forEach((node) => {
      node.position.x += offsetX
    })
  }

  return { nodes, edges }
}

// Inner component that uses useReactFlow hook
function OrganizationHierarchyFlowInner({
  hierarchy,
  loading,
  onRefresh,
  tenantId,
  tenantName,
  onNodeClick,
  onEditOrganization,
  onDeleteOrganization,
  onAddSubOrganization,
  onAddLocation,
  onTransferCredits,
}: OrganizationHierarchyFlowProps) {
  const [showCreditAllocationModal, setShowCreditAllocationModal] =
    useState(false)
  const [selectedEntityForAllocation, setSelectedEntityForAllocation] =
    useState<{
      id: string
      name: string
      type: 'organization' | 'location'
      availableCredits: number
    } | null>(null)

  const { fitView, zoomIn, zoomOut } = useReactFlow()

  const handleAllocateCredits = useCallback(
    (entityId: string) => {
      // Find the entity in the hierarchy to get its details
      const findEntity = (entities: any[]): any => {
        for (const entity of entities) {
          if (
            entity.entityId === entityId ||
            entity.organizationId === entityId
          ) {
            return entity
          }
          if (entity.children) {
            const found = findEntity(entity.children)
            if (found) return found
          }
        }
        return null
      }

      const entity = hierarchy?.hierarchy
        ? findEntity(hierarchy.hierarchy)
        : null
      if (entity) {
        setSelectedEntityForAllocation({
          id: entityId,
          name: entity.entityName || entity.organizationName,
          type: entity.entityType || 'organization',
          availableCredits: entity.availableCredits || 0,
        })
        setShowCreditAllocationModal(true)
      }
    },
    [hierarchy]
  )

  // Convert hierarchy to React Flow format
  const { nodes, edges } = useMemo(() => {
    const result = convertHierarchyToFlow(
      hierarchy,
      tenantId,
      tenantName,
      onNodeClick,
      onEditOrganization,
      onDeleteOrganization,
      onAddSubOrganization,
      onAddLocation,
      handleAllocateCredits,
      onTransferCredits
    )
    return result
  }, [
    hierarchy,
    tenantId,
    tenantName,
    onNodeClick,
    onEditOrganization,
    onDeleteOrganization,
    onAddSubOrganization,
    onAddLocation,
    handleAllocateCredits,
    onTransferCredits,
  ])

  // Fit view when nodes change
  useEffect(() => {
    if (nodes.length > 0) {
      setTimeout(() => {
        fitView({ padding: 0.3, duration: 600, includeHiddenNodes: false })
      }, 200)
    }
  }, [nodes.length, fitView])

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2, duration: 500 })
  }, [fitView])

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[#1B2E5A]" />
          <p className="text-gray-600">Loading organization hierarchy...</p>
        </div>
      </div>
    )
  }

  if (!hierarchy || nodes.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-50">
        <div className="text-center">
          <Building className="mx-auto mb-4 h-16 w-16 text-gray-400" />
          <h3 className="mb-2 text-xl font-semibold text-[#1B2E5A]">
            No Organizations Found
          </h3>
          <p className="mb-4 text-gray-600">
            Create your first organization to get started.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative h-full w-full bg-gray-50"
      style={{ width: '100%', height: '100%', minHeight: '600px' }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="bg-transparent"
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        selectNodesOnDrag={false}
        panOnScroll={true}
        panOnDrag={[1, 2]} // Pan with middle mouse button or space+click
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
        <Controls className="rounded-lg border border-gray-200 bg-white shadow-sm" />
        <MiniMap
          className="rounded-lg border border-gray-200 bg-white shadow-sm"
          nodeColor={(node) => {
            const entityType = node.data?.entityType
            if (entityType === 'location') return '#f59e0b'
            return node.data?.isActive ? '#1B2E5A' : '#9ca3af'
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
        <Panel
          position="top-left"
          className="rounded-2xl border border-[#1B2E5A]/20 bg-gradient-to-r from-[#1B2E5A]/5 to-white p-3 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Building className="h-5 w-5 text-[#1B2E5A]" />
            <div>
              <h3 className="text-sm font-black text-[#1B2E5A]">
                Organization Hierarchy
              </h3>
              <p className="text-muted-foreground text-xs">
                {hierarchy.totalOrganizations}{' '}
                {hierarchy.totalOrganizations === 1
                  ? 'organization'
                  : 'organizations'}
              </p>
            </div>
          </div>
        </Panel>
        <Panel position="top-right" className="flex gap-2">
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="border border-[#1B2E5A]/20 bg-white shadow-sm hover:bg-[#1B2E5A]/5"
            >
              <RefreshCw className="mr-2 h-4 w-4 text-[#1B2E5A]" />
              <span className="font-medium text-[#1B2E5A]">Refresh</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleFitView}
            className="border border-[#1B2E5A]/20 bg-white shadow-sm hover:bg-[#1B2E5A]/5"
          >
            <Maximize2 className="mr-2 h-4 w-4 text-[#1B2E5A]" />
            <span className="font-medium text-[#1B2E5A]">Fit View</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => zoomIn({ duration: 300 })}
            className="border border-[#1B2E5A]/20 bg-white shadow-sm hover:bg-[#1B2E5A]/5"
          >
            <ZoomIn className="h-4 w-4 text-[#1B2E5A]" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => zoomOut({ duration: 300 })}
            className="border border-[#1B2E5A]/20 bg-white shadow-sm hover:bg-[#1B2E5A]/5"
          >
            <ZoomOut className="h-4 w-4 text-[#1B2E5A]" />
          </Button>
        </Panel>
      </ReactFlow>

      {/* Allocate credits (drawer — same pattern as list view) */}
      {selectedEntityForAllocation && (
        <CreditAllocationModal
          isOpen={showCreditAllocationModal}
          onClose={() => {
            setShowCreditAllocationModal(false)
            setSelectedEntityForAllocation(null)
          }}
          onSuccess={() => {
            onRefresh?.()
          }}
          entityId={selectedEntityForAllocation.id}
          entityName={selectedEntityForAllocation.name}
          entityType={selectedEntityForAllocation.type}
          availableCredits={selectedEntityForAllocation.availableCredits}
        />
      )}
    </div>
  )
}

// Outer component that provides ReactFlowProvider
export function OrganizationHierarchyFlow(
  props: OrganizationHierarchyFlowProps
) {
  return (
    <div
      className="h-full min-h-[400px] w-full"
      style={{ width: '100%', height: '100%' }}
    >
      <ReactFlowProvider>
        <OrganizationHierarchyFlowInner {...props} />
      </ReactFlowProvider>
    </div>
  )
}
