/**
 * Matrix Spaces Store
 * Manages Matrix spaces (communities) state and operations
 */

import { defineStore } from 'pinia'
import { matrixSpacesService, type SpaceInfo, type SpaceChild } from '@/services/matrixSpacesService'
import { logger } from '@/utils/logger'

export interface SpaceNode {
  space: SpaceInfo
  level: number
  children: SpaceNode[]
  expanded?: boolean
}

interface SpacesState {
  /** All loaded spaces */
  spaces: Record<string, SpaceInfo>
  /** Currently selected space ID */
  selectedSpaceId: string | null
  /** Selected room ID within a space */
  selectedRoomId: string | null
  /** Space hierarchy tree */
  spaceTree: SpaceNode[]
  /** Loading state */
  loading: boolean
  /** Error message */
  error: string | null
  /** Expanded spaces (for tree view) */
  expandedSpaces: Set<string>
  /** initialization status */
  initialized: boolean
}

export const useSpacesStore = defineStore('spaces', {
  state: (): SpacesState => ({
    spaces: {},
    selectedSpaceId: null,
    selectedRoomId: null,
    spaceTree: [],
    loading: false,
    error: null,
    expandedSpaces: new Set<string>(),
    initialized: false
  }),

  getters: {
    /**
     * Get all top-level spaces (spaces with no parents)
     */
    topLevelSpaces: (state): SpaceInfo[] => {
      return Object.values(state.spaces).filter((space) => space.parents.length === 0)
    },

    /**
     * Get currently selected space
     */
    selectedSpace: (state): SpaceInfo | null => {
      return state.selectedSpaceId ? state.spaces[state.selectedSpaceId] || null : null
    },

    /**
     * Get spaces that should be displayed in the left sidebar
     * (top-level spaces sorted by name)
     */
    sidebarSpaces(): SpaceInfo[] {
      return this.topLevelSpaces.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    },

    /**
     * Check if a space is expanded
     */
    isSpaceExpanded:
      (state) =>
      (spaceId: string): boolean => {
        return state.expandedSpaces.has(spaceId)
      },

    /**
     * Get children of a space
     */
    getSpaceChildren:
      (state) =>
      (spaceId: string): SpaceChild[] => {
        const space = state.spaces[spaceId]
        return space?.children || []
      }
  },

  actions: {
    /**
     * Initialize the spaces store
     */
    async initialize(): Promise<void> {
      if (this.initialized) {
        logger.debug('[SpacesStore] Already initialized')
        return
      }

      this.loading = true
      this.error = null

      try {
        logger.info('[SpacesStore] Initializing spaces store')

        // Initialize the spaces service
        await matrixSpacesService.initialize()

        // Load all spaces
        await this.loadSpaces()

        this.initialized = true
        logger.info('[SpacesStore] Spaces store initialized successfully')
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to initialize spaces'
        logger.error('[SpacesStore] Failed to initialize:', error)
      } finally {
        this.loading = false
      }
    },

    /**
     * Load all spaces the user is a member of
     */
    async loadSpaces(): Promise<void> {
      this.loading = true
      this.error = null

      try {
        logger.info('[SpacesStore] Loading spaces')

        const spaces = await matrixSpacesService.loadSpaces()

        // Convert to record
        this.spaces = {}
        for (const space of spaces) {
          this.spaces[space.roomId] = space
        }

        // Build space tree
        this.buildSpaceTree()

        logger.info('[SpacesStore] Spaces loaded', { count: spaces.length })
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to load spaces'
        logger.error('[SpacesStore] Failed to load spaces:', error)
      } finally {
        this.loading = false
      }
    },

    /**
     * Build space hierarchy tree
     */
    buildSpaceTree(): void {
      const visited = new Set<string>()

      const buildNode = (spaceId: string, level = 0): SpaceNode | null => {
        // Prevent infinite loops
        if (visited.has(spaceId)) {
          logger.warn('[SpacesStore] Circular reference detected in space hierarchy', { spaceId })
          return null
        }
        visited.add(spaceId)

        const space = this.spaces[spaceId]
        if (!space) {
          return null
        }

        const children: SpaceNode[] = []

        // Build child nodes
        for (const child of space.children) {
          const childNode = buildNode(child.roomId, level + 1)
          if (childNode) {
            children.push(childNode)
          }
        }

        return {
          space,
          level,
          children,
          expanded: this.expandedSpaces.has(spaceId)
        }
      }

      // Build tree from top-level spaces
      this.spaceTree = this.topLevelSpaces
        .map((space) => buildNode(space.roomId))
        .filter((node): node is SpaceNode => node !== null)
    },

    /**
     * Select a space
     */
    selectSpace(spaceId: string | null): void {
      this.selectedSpaceId = spaceId
      this.selectedRoomId = null

      // Auto-expand the selected space
      if (spaceId) {
        this.toggleSpaceExpand(spaceId, true)
      }

      logger.debug('[SpacesStore] Space selected', { spaceId })
    },

    /**
     * Select a room within a space
     */
    selectRoom(roomId: string): void {
      this.selectedRoomId = roomId

      // Find which space contains this room
      for (const space of Object.values(this.spaces)) {
        if (space.children.some((child) => child.roomId === roomId)) {
          this.selectedSpaceId = space.roomId
          break
        }
      }

      logger.debug('[SpacesStore] Room selected', { roomId })
    },

    /**
     * Toggle space expansion
     */
    toggleSpaceExpand(spaceId: string, forceState?: boolean): void {
      const isExpanded = this.expandedSpaces.has(spaceId)

      if (forceState === true) {
        this.expandedSpaces.add(spaceId)
      } else if (forceState === false) {
        this.expandedSpaces.delete(spaceId)
      } else {
        if (isExpanded) {
          this.expandedSpaces.delete(spaceId)
        } else {
          this.expandedSpaces.add(spaceId)
        }
      }

      // Rebuild tree to update expanded states
      this.buildSpaceTree()

      logger.debug('[SpacesStore] Space expansion toggled', { spaceId, expanded: !isExpanded })
    },

    /**
     * Create a new space
     */
    async createSpace(options: {
      name: string
      topic?: string
      avatar?: File
      visibility: 'public' | 'private'
    }): Promise<string> {
      this.loading = true
      this.error = null

      try {
        logger.info('[SpacesStore] Creating space', { name: options.name })

        const roomId = await matrixSpacesService.createSpace(options)

        // Reload spaces to get the new one
        await this.loadSpaces()

        // Select the newly created space
        this.selectSpace(roomId)

        logger.info('[SpacesStore] Space created successfully', { roomId })
        return roomId
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to create space'
        logger.error('[SpacesStore] Failed to create space:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Add a room to a space
     */
    async addRoomToSpace(parentSpaceId: string, childRoomId: string, order?: string): Promise<void> {
      this.error = null

      try {
        logger.info('[SpacesStore] Adding room to space', { parentSpaceId, childRoomId })

        await matrixSpacesService.addChildToSpace(parentSpaceId, childRoomId, order)

        // Reload to get updated hierarchy
        await this.loadSpaces()

        logger.info('[SpacesStore] Room added to space successfully')
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to add room to space'
        logger.error('[SpacesStore] Failed to add room to space:', error)
        throw error
      }
    },

    /**
     * Remove a room from a space
     */
    async removeRoomFromSpace(parentSpaceId: string, childRoomId: string): Promise<void> {
      this.error = null

      try {
        logger.info('[SpacesStore] Removing room from space', { parentSpaceId, childRoomId })

        await matrixSpacesService.removeChildFromSpace(parentSpaceId, childRoomId)

        // Reload to get updated hierarchy
        await this.loadSpaces()

        logger.info('[SpacesStore] Room removed from space successfully')
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to remove room from space'
        logger.error('[SpacesStore] Failed to remove room from space:', error)
        throw error
      }
    },

    /**
     * Join a space
     */
    async joinSpace(roomId: string): Promise<void> {
      this.loading = true
      this.error = null

      try {
        logger.info('[SpacesStore] Joining space', { roomId })

        await matrixSpacesService.joinSpace(roomId)

        // Reload spaces
        await this.loadSpaces()

        // Select the joined space
        this.selectSpace(roomId)

        logger.info('[SpacesStore] Space joined successfully')
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to join space'
        logger.error('[SpacesStore] Failed to join space:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Leave a space
     */
    async leaveSpace(roomId: string): Promise<void> {
      this.loading = true
      this.error = null

      try {
        logger.info('[SpacesStore] Leaving space', { roomId })

        await matrixSpacesService.leaveSpace(roomId)

        // Remove from local state
        delete this.spaces[roomId]

        // Clear selection if this was the selected space
        if (this.selectedSpaceId === roomId) {
          this.selectedSpaceId = null
        }

        // Rebuild tree
        this.buildSpaceTree()

        logger.info('[SpacesStore] Space left successfully')
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to leave space'
        logger.error('[SpacesStore] Failed to leave space:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Refresh spaces data
     */
    async refresh(): Promise<void> {
      await this.loadSpaces()
    },

    /**
     * Clear all spaces data
     */
    clear(): void {
      this.spaces = {}
      this.selectedSpaceId = null
      this.selectedRoomId = null
      this.spaceTree = []
      this.expandedSpaces.clear()
      this.initialized = false
      this.error = null

      logger.info('[SpacesStore] Spaces cleared')
    }
  }
})
