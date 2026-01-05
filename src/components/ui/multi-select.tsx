"use client"

import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

export interface Option {
  value: string
  label: string
  disable?: boolean
  /** fixed option that can't be removed. */
  fixed?: boolean
  /** Group the options by providing key. */
  [key: string]: string | boolean | undefined
}
interface GroupOption {
  [key: string]: Option[]
}

interface MultiSelectProps {
  options: Option[]
  value: Option[]
  onValueChange: (value: Option[]) => void
  onSearch?: (value: string) => void
  placeholder?: string
  animation?: number
  maxCount?: number
  /**
   * The directory of the component. Default is "ltr".
   *
   * @default "ltr"
   */
  dir?: "ltr" | "rtl"
  /**
   * The ref of the input element.
   *
   * @default null
   * @type React.Ref<HTMLInputElement>
   */
  inputRef?: React.Ref<HTMLInputElement>
}

export function MultiSelect({
  options,
  value,
  onValueChange,
  onSearch,
  placeholder,
  animation,
  maxCount,
  dir,
  inputRef,
}: MultiSelectProps) {
  const [inputValue, setInputValue] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const [focus, setFocus] = React.useState(false)

  const handleUnselect = (option: Option) => {
    onValueChange(value.filter((s) => s.value !== option.value))
  }

  const handleSelect = (option: Option) => {
    if (maxCount && value.length >= maxCount) {
      return
    }
    if (!value.some((s) => s.value === option.value)) {
      onValueChange([...value, option])
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.key === "Backspace" || e.key === "Delete") && value.length > 0) {
      if (inputValue === "") {
        const lastSelect = value[value.length - 1]
        if (!lastSelect.fixed) {
          handleUnselect(lastSelect)
        }
      }
    } else if (e.key === "Enter") {
      setOpen(true)
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  const groupedOptions: GroupOption = options.reduce(
    (acc: GroupOption, option) => {
      const group = (option.group as string) || ""
      if (!acc[group]) {
        acc[group] = []
      }
      acc[group].push(option)
      return acc
    },
    {}
  )

  return (
    <CommandPrimitive
      onKeyDown={handleKeyDown}
      className="overflow-visible bg-transparent"
      shouldFilter={false}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
    >
      <div
        className={cn(
          "min-h-10 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          "group rounded-md border border-input px-3 py-2",
          focus && "ring-2 ring-ring ring-offset-2"
        )}
      >
        <div className="flex flex-wrap gap-1">
          {value.map((option) => {
            return (
              <Badge
                key={option.value}
                variant="outline"
                className={cn(
                  "data-[disabled]:bg-muted-foreground data-[disabled]:text-muted data-[disabled]:hover:bg-muted-foreground",
                  "data-[fixed]:bg-muted-foreground data-[fixed]:text-muted data-[fixed]:hover:bg-muted-foreground",
                  animation && "animate-in fade-in-0"
                )}
                data-fixed={option.fixed}
                data-disabled={option.disable}
              >
                {option.label}
                <button
                  className={cn(
                    "ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    (option.fixed || option.disable) && "hidden"
                  )}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleUnselect(option)
                    }
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onClick={() => handleUnselect(option)}
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              </Badge>
            )
          })}
          <CommandPrimitive.Input
            ref={inputRef}
            value={inputValue}
            onValueChange={setInputValue}
            onBlur={() => setOpen(false)}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className={cn(
              "flex-1 bg-transparent px-1 py-0.5 outline-none placeholder:text-muted-foreground",
              value.length > 0 && "w-fit"
            )}
            disabled={maxCount ? value.length >= maxCount : false}
            onInput={(e) => onSearch?.(e.currentTarget.value)}
          />
        </div>
      </div>
      <div className="relative mt-2">
        {open && options.length > 0 && (
          <div
            className={cn(
              "absolute top-0 z-10 w-full rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in",
              dir === "rtl" ? "right-0" : "left-0"
            )}
          >
            <CommandList>
              {Object.entries(groupedOptions).map(([group, options]) => (
                <CommandGroup
                  key={group}
                  heading={group}
                  className="h-full overflow-auto"
                >
                  <>
                    {options.map((option) => {
                      return (
                        <CommandItem
                          key={option.value}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                          }}
                          onSelect={() => handleSelect(option)}
                          className={cn(
                            "cursor-pointer",
                            option.disable &&
                              "cursor-default text-muted-foreground"
                          )}
                          disabled={option.disable}
                        >
                          {option.label}
                        </CommandItem>
                      )
                    })}
                  </>
                </CommandGroup>
              ))}
            </CommandList>
          </div>
        )}
      </div>
    </CommandPrimitive>
  )
}
