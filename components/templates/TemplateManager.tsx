'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { TemplateCard } from './TemplateCard'
import { ConfirmDialog } from '@/components/todos/ConfirmDialog'
import { useTemplates } from '@/lib/hooks/useTemplates'
import { useTags } from '@/lib/hooks/useTags'
import { TEMPLATE_CATEGORIES } from '@/lib/tokens/templates'

interface TemplateManagerProps {
  isOpen: boolean
  onClose: () => void
}

export function TemplateManager({ isOpen, onClose }: TemplateManagerProps) {
  const { templates, isLoading, deleteTemplate, useTemplateMutation } = useTemplates()
  const { tags } = useTags()
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const categories = Array.from(
    new Set(templates.map((t) => t.category).filter((c): c is string => c !== null))
  )

  const displayedCategories = Array.from(
    new Set([...TEMPLATE_CATEGORIES, ...categories])
  ).filter((c) => templates.some((t) => t.category === c))

  const displayed = categoryFilter === 'all'
    ? templates
    : templates.filter((t) => t.category === categoryFilter)

  function handleUse(id: number) {
    useTemplateMutation.mutate({ id }, {
      onSuccess: () => {
        onClose()
      },
    })
  }

  function handleDeleteRequest(id: number) {
    setDeletingId(id)
  }

  function handleDeleteConfirm() {
    if (deletingId !== null) {
      deleteTemplate.mutate(deletingId)
      setDeletingId(null)
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
        <DialogContent
          className="max-w-[640px] max-h-[80vh] flex flex-col"
          data-testid="template-manager-modal"
        >
          <DialogHeader>
            <DialogTitle>Templates</DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              Loading templates...
            </div>
          ) : templates.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-12 text-center"
              data-testid="template-empty-state"
            >
              <p className="text-muted-foreground text-sm">No templates yet.</p>
              <p className="text-muted-foreground text-xs mt-1">
                Save a todo as a template to get started.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 overflow-hidden">
              <Tabs value={categoryFilter} onValueChange={setCategoryFilter}>
                <TabsList className="flex flex-wrap h-auto gap-1">
                  <TabsTrigger
                    value="all"
                    data-testid="template-category-all"
                  >
                    All ({templates.length})
                  </TabsTrigger>
                  {displayedCategories.map((cat) => (
                    <TabsTrigger
                      key={cat}
                      value={cat}
                      data-testid={`template-category-${cat.toLowerCase()}`}
                    >
                      {cat}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value={categoryFilter} className="mt-4 overflow-y-auto max-h-[50vh]">
                  {displayed.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No templates in this category.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {displayed.map((template) => (
                        <TemplateCard
                          key={template.id}
                          template={template}
                          tags={tags}
                          onUse={handleUse}
                          onDelete={handleDeleteRequest}
                        />
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-border mt-auto">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={deletingId !== null}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Template"
        message="Are you sure you want to delete this template? This will not affect todos already created from it."
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />
    </>
  )
}
