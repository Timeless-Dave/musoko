'use client';

import {
  Children,
  isValidElement,
  useState,
  type ChangeEvent,
  type ComponentProps,
  type OptionHTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';
import { Listbox, type ListOption } from './Listbox';

/** Options in order, including those inside an <optgroup>. */
function optionsOf(children: ReactNode): ListOption[] {
  return Children.toArray(children).flatMap((child): ListOption[] => {
    if (!isValidElement(child)) return [];
    if (child.type === 'optgroup') return optionsOf((child.props as { children?: ReactNode }).children);
    if (child.type !== 'option') return [];
    const props = child.props as OptionHTMLAttributes<HTMLOptionElement>;
    const value = props.value == null ? '' : String(props.value);
    const label = typeof props.children === 'string' ? props.children : value;
    return [{ value, label }];
  });
}

/** Custom listbox with the old native-select API, so existing forms stay as they are. */
export function Select({
  label,
  optionalLabel,
  hint,
  error,
  className,
  children,
  value,
  defaultValue,
  onChange,
  disabled,
}: {
  label: string;
  optionalLabel?: string;
  hint?: string;
  error?: string;
  ref?: Ref<HTMLSelectElement>;
} & Omit<ComponentProps<'select'>, 'ref'>) {
  const options = optionsOf(children);
  const controlled = value !== undefined;
  const [inner, setInner] = useState(String(defaultValue ?? options[0]?.value ?? ''));
  const current = controlled ? String(value) : inner;
  return (
    <Listbox
      label={label}
      optionalLabel={optionalLabel}
      hint={hint}
      error={error}
      value={current}
      disabled={disabled}
      className={className}
      searchable={options.length > 6}
      options={options}
      onValueChange={(next) => {
        if (!controlled) setInner(next);
        const event = { target: { value: next }, currentTarget: { value: next } } as ChangeEvent<HTMLSelectElement>;
        onChange?.(event);
      }}
    />
  );
}