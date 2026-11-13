import * as React from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Shared class string for select triggers (matches `Input` focus and sizing). */
export const selectFieldClassName =
  'min-h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-base text-foreground shadow-sm outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50';

type ParsedOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type MenuGeometry = {
  left: number;
  top: number;
  width: number;
};

function childLabel(child: React.ReactElement<React.OptionHTMLAttributes<HTMLOptionElement>>): string {
  const { children } = child.props;
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map((part) => (typeof part === 'string' || typeof part === 'number' ? String(part) : '')).join('');
  }
  return String(child.props.value ?? '');
}

function isOptionElement(child: React.ReactElement): child is React.ReactElement<React.OptionHTMLAttributes<HTMLOptionElement>> {
  return typeof child.type === 'string' && child.type === 'option';
}

function parseOptionChildren(children: React.ReactNode): ParsedOption[] {
  const items: ParsedOption[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child) || !isOptionElement(child)) return;
    const props = child.props;
    const value = props.value === undefined || props.value === null ? '' : String(props.value);
    items.push({
      value,
      label: childLabel(child),
      disabled: props.disabled,
    });
  });
  return items;
}

function isSelectChangeEvent(
  onChange: React.ComponentProps<'select'>['onChange'],
): onChange is React.ChangeEventHandler<HTMLSelectElement> {
  return typeof onChange === 'function';
}

export type NativeSelectProps = {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  children: React.ReactNode;
  className?: string;
  defaultValue?: React.ComponentProps<'select'>['defaultValue'];
  disabled?: boolean;
  id?: string;
  name?: string;
  onChange?: React.ComponentProps<'select'>['onChange'];
  value?: React.ComponentProps<'select'>['value'];
};

export const NativeSelect = React.forwardRef<HTMLButtonElement, NativeSelectProps>(
  ({ className, children, value, defaultValue, onChange, disabled, id, name, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby }, ref) => {
    const options = React.useMemo(() => parseOptionChildren(children), [children]);
    const [open, setOpen] = React.useState(false);
    const [activeIndex, setActiveIndex] = React.useState(-1);
    const [menuGeometry, setMenuGeometry] = React.useState<MenuGeometry | null>(null);
    const rootRef = React.useRef<HTMLDivElement>(null);
    const triggerRef = React.useRef<HTMLButtonElement | null>(null);
    const listId = React.useId();

    const setRefs = React.useCallback(
      (node: HTMLButtonElement | null) => {
        triggerRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );

    const resolvedValue =
      value !== undefined && value !== null
        ? String(value)
        : defaultValue !== undefined && defaultValue !== null
          ? String(defaultValue)
          : (options.find((row) => !row.disabled)?.value ?? '');

    const selectedOption = options.find((row) => row.value === resolvedValue);
    const displayLabel = selectedOption?.label ?? resolvedValue;

    const syncMenuGeometry = React.useCallback(() => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      setMenuGeometry({
        left: rect.left,
        top: rect.bottom + 4,
        width: rect.width,
      });
    }, []);

    const close = React.useCallback(() => {
      setOpen(false);
      setActiveIndex(-1);
      setMenuGeometry(null);
    }, []);

    const pick = React.useCallback(
      (next: string) => {
        close();
        if (!isSelectChangeEvent(onChange)) return;
        const target = { value: next, name: name ?? '' } as HTMLSelectElement;
        onChange({ target, currentTarget: target } as React.ChangeEvent<HTMLSelectElement>);
      },
      [close, name, onChange],
    );

    React.useEffect(() => {
      if (!open) return;
      syncMenuGeometry();
      const onViewportChange = () => syncMenuGeometry();
      window.addEventListener('resize', onViewportChange);
      window.addEventListener('scroll', onViewportChange, true);
      return () => {
        window.removeEventListener('resize', onViewportChange);
        window.removeEventListener('scroll', onViewportChange, true);
      };
    }, [open, syncMenuGeometry]);

    React.useEffect(() => {
      if (!open) return;
      const selectedIndex = options.findIndex((row) => row.value === resolvedValue);
      setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }, [open, options, resolvedValue]);

    React.useEffect(() => {
      if (!open) return;
      const onDocumentClick = (event: MouseEvent) => {
        const target = event.target as Node;
        if (rootRef.current?.contains(target)) return;
        const portalMenu = document.getElementById(listId);
        if (portalMenu?.contains(target)) return;
        close();
      };
      const timer = window.setTimeout(() => {
        document.addEventListener('click', onDocumentClick, true);
      }, 0);
      return () => {
        window.clearTimeout(timer);
        document.removeEventListener('click', onDocumentClick, true);
      };
    }, [close, listId, open]);

    React.useEffect(() => {
      if (!open) return;
      const onEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          close();
          triggerRef.current?.focus();
        }
      };
      document.addEventListener('keydown', onEscape);
      return () => document.removeEventListener('keydown', onEscape);
    }, [close, open]);

    const moveActive = (delta: number) => {
      if (options.length === 0) return;
      let index = activeIndex;
      for (let step = 0; step < options.length; step += 1) {
        index = (index + delta + options.length) % options.length;
        if (!options[index]?.disabled) {
          setActiveIndex(index);
          return;
        }
      }
    };

    const toggleOpen = () => {
      if (disabled) return;
      if (open) {
        close();
        return;
      }
      syncMenuGeometry();
      setOpen(true);
    };

    const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (!open) {
          syncMenuGeometry();
          setOpen(true);
          return;
        }
        if (event.key === 'ArrowDown') moveActive(1);
        if (event.key === 'ArrowUp') moveActive(-1);
        if (event.key === 'Enter' || event.key === ' ') {
          const option = options[activeIndex];
          if (option && !option.disabled) pick(option.value);
        }
      }
    };

    const listbox =
      open && menuGeometry && typeof document !== 'undefined'
        ? createPortal(
            <ul
              className="scrollbar-surface fixed z-[100] max-h-60 overflow-auto rounded-xl border border-input bg-card py-1 text-foreground shadow-lg"
              id={listId}
              role="listbox"
              style={{
                left: menuGeometry.left,
                top: menuGeometry.top,
                width: menuGeometry.width,
              }}
              tabIndex={-1}
            >
              {options.map((option, index) => {
                const isSelected = option.value === resolvedValue;
                const isActive = index === activeIndex;
                return (
                  <li
                    key={`${option.value}-${option.label}`}
                    aria-disabled={option.disabled || undefined}
                    aria-selected={isSelected}
                    className={cn(
                      'cursor-pointer px-3 py-2.5 text-base transition-colors',
                      option.disabled && 'cursor-not-allowed opacity-50',
                      (isSelected || isActive) && 'bg-primary text-primary-foreground',
                      !isSelected && !isActive && 'hover:bg-primary hover:text-primary-foreground',
                    )}
                    onMouseEnter={() => !option.disabled && setActiveIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (option.disabled) return;
                      pick(option.value);
                    }}
                    role="option"
                  >
                    {option.label}
                  </li>
                );
              })}
            </ul>,
            document.body,
          )
        : null;

    return (
      <div className="relative min-w-0 w-full" ref={rootRef}>
        <button
          type="button"
          ref={setRefs}
          id={id}
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={open ? listId : undefined}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledby}
          className={cn(selectFieldClassName, 'flex items-center justify-between gap-2 text-left', className)}
          onClick={(event) => {
            event.stopPropagation();
            toggleOpen();
          }}
          onKeyDown={onTriggerKeyDown}
          onPointerDown={(event) => {
            if (disabled) return;
            event.stopPropagation();
          }}
        >
          <span className="min-w-0 flex-1 truncate">{displayLabel}</span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150',
              open && 'rotate-180',
            )}
          />
        </button>
        {listbox}
        {name ? <input name={name} type="hidden" value={resolvedValue} /> : null}
      </div>
    );
  },
);
NativeSelect.displayName = 'NativeSelect';
