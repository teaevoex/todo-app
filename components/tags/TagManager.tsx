'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ColorPicker } from '@/components/common/ColorPicker'
import { useTags } from '@/lib/hooks/useTags'
import { tagDefaultPalette } from '@/lib/tokens/tags'
import type { Tag } from '@/lib/types'

interface TagManagerProps {
  isOpen: boolean
  onClose: () => void
}

export function TagManager({ isOpen, onClose }: TagManagerProps) {
  const { tags, createTag, updateTag, deleteTag } = useTags()

  // Create form state
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState<string>(tagDefaultPalette[0])
  const [createError, setCreateError] = useState<string | null>(null)

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [editError, setEditError] = useState<string | null>(null)

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  function handleCreate() {
    const name = newName.trim()
    if (!name) {
      setCreateError('Name is required')
      return
    }
    setCreateError(null)
    createTag.mutate(
      { name, color: newColor },
      {
        onSuccess: () => {
          setNewName('')
          setNewColor(tagDefaultPalette[0])
        },
        onError: (err) => {
          setCreateError(err instanceof Error ? err.message : 'Failed to create tag')
        },
      }
    )
  }

  function startEdit(tag: Tag) {
    setEditingId(tag.id)
    setEditName(tag.name)
    setEditColor(tag.color)
    setEditError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError(null)
  }

  function handleSave(id: number) {
    const name = editName.trim()
    if (!name) {
      setEditError('Name is required')
      return
    }
    setEditError(null)
    updateTag.mutate(
      { id, dto: { name, color: editColor } },
      {
        onSuccess: () => {
          setEditingId(null)
        },
        onError: (err) => {
          setEditError(err instanceof Error ? err.message : 'Failed to update tag')
        },
      }
    )
  }

  function handleDelete(id: number) {
    deleteTag.mutate(id, {
      onSuccess: () => {
        setConfirmDeleteId(null)
      },
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
        className="max-w-[480px]"
        data-testid="tag-manager-modal"
        data-testid-alias="tag-manager"
        aria-label="Manage Tags"
      >
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
        </DialogHeader>

        {/* Create new tag form */}
        <div className="rounded-lg border border-border bg-muted/30 p-3 flex flex-col gap-3">
          <p className="text-sm font-medium text-foreground">New Tag</p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="tag-name-input" className="text-xs text-muted-foreground">
              Name
            </Label>
            <Input
              id="tag-name-input"
              data-testid="tag-name-input"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value)
                if (createError) setCreateError(null)
              }}
              placeholder="Tag name"
              maxLength={50}
              className="h-8 text-sm"
            />
            {createError && (
              <p role="alert" className="text-xs text-destructive">{createError}</p>
            )}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Color</Label>
            <ColorPicker value={newColor} onChange={setNewColor} />
          </div>
          <Button
            type="button"
            size="sm"
            data-testid="create-tag-submit"
            onClick={handleCreate}
            disabled={createTag.isPending}
          >
            {createTag.isPending ? 'Adding...' : 'Add Tag'}
          </Button>
        </div>

        {/* Tag list */}
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
          {tags.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No tags yet. Create your first one above.
            </p>
          ) : (
            tags.map((tag) => (
              <div
                key={tag.id}
                data-testid={`tag-row-${tag.name}`}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
              >
                {editingId === tag.id ? (
                  <div className="flex flex-1 flex-col gap-2">
                    <Input
                      data-testid={`tag-name-edit-${tag.id}`}
                      value={editName}
                      onChange={(e) => {
                        setEditName(e.target.value)
                        if (editError) setEditError(null)
                      }}
                      maxLength={50}
                      className="h-7 text-sm"
                    />
                    {editError && (
                      <p role="alert" className="text-xs text-destructive">{editError}</p>
                    )}
                    <ColorPicker value={editColor} onChange={setEditColor} />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        data-testid={`save-tag-${tag.id}`}
                        onClick={() => handleSave(tag.id)}
                        disabled={updateTag.isPending}
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={cancelEdit}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span
                      className="inline-block h-3 w-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="flex-1 text-sm font-medium text-foreground truncate">
                      {tag.name}
                    </span>
                    {confirmDeleteId === tag.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Delete?</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="h-6 px-2 text-xs"
                          onClick={() => handleDelete(tag.id)}
                          disabled={deleteTag.isPending}
                        >
                          Yes
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-xs"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          No
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          data-testid={`edit-tag-${tag.id}`}
                          onClick={() => startEdit(tag)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                          data-testid={`delete-tag-${tag.id}`}
                          onClick={() => setConfirmDeleteId(tag.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
