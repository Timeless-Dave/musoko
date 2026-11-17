'use client';

import { useState, useSyncExternalStore, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog as RadixDialog } from 'radix-ui';
import { ArrowLeft, Basket, Plant, User, X } from '@phosphor-icons/react';
import { services } from '@/data';
import type { UserRole } from '@/domain/types';
import { copy } from '@/content/copy';
import { Button, Field } from '@/design-system/primitives';
import { SESSION_KEY } from '@/features/auth';

const SEEN_KEY = 'musoko.welcome.v1';

type Who = 'customer' | 'farmer' | 'guest';
const ROLE_FOR: Record<Who, UserRole> = { customer: 'buyer', farmer: 'farmer', guest: 'buyer' };
const ICON = { customer: Basket, farmer: Plant, guest: User } as const;
const ORDER: Who[] = ['customer', 'farmer', 'guest'];

function readSeen(): boolean {
  try {
    return Boolean(localStorage.getItem(SEEN_KEY));
  } catch {
    // Storage blocked: treat as seen so the dialog does not loop every visit.
    return true;
  }
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  return () => window.removeEventListener('storage', onStoreChange);
}

/**
 * First-visit chooser. Sign-in is a placeholder: the email and password stay in
 * component state, are never stored, and the only effect is the demo role switch.
 */
export function WelcomeDialog() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const storedSeen = useSyncExternalStore(subscribe, readSeen, () => true);
  const [closed, setClosed] = useState(false);
  const [who, setWho] = useState<Who | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tried, setTried] = useState(false);
  const open = !storedSeen && !closed;

  const markSeen = (value: string) => {
    try {
      localStorage.setItem(SEEN_KEY, value);
    } catch {
      /* ignore */
    }
    setClosed(true);
  };

  const finish = async (choice: Who) => {
    markSeen(choice);
    if (services.demo) {
      await services.demo.switchRole(ROLE_FOR[choice]);
      await queryClient.refetchQueries({ queryKey: SESSION_KEY });
    }
    if (choice === 'farmer') router.push('/dashboard');
  };

  const dismiss = (next: boolean) => {
    if (next) return;
    markSeen('dismissed');
  };

  const pick = (choice: Who) => {
    if (choice === 'guest') {
      void finish('guest');
      return;
    }
    setWho(choice);
    setTried(false);
    setEmail('');
    setPassword('');
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTried(true);
    setPassword('');
  };

  const label = who ? copy.welcome.roles[who].label : '';

  return (
    <RadixDialog.Root open={open} onOpenChange={dismiss}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="scrim scrim--dialog" />
        <RadixDialog.Content className="dialog welcome" aria-describedby={undefined}>
          {who === null ? (
            <>
              <RadixDialog.Title className="dialog__title">{copy.welcome.title}</RadixDialog.Title>
              <p className="welcome__lead">{copy.welcome.lead}</p>
              <ul className="welcome__choices">
                {ORDER.map((choice) => {
                  const Icon = ICON[choice];
                  return (
                    <li key={choice}>
                      <button type="button" className="welcome__choice" onClick={() => pick(choice)}>
                        <span className="welcome__icon" aria-hidden="true">
                          <Icon size={26} weight="bold" />
                        </span>
                        <span>
                          <span className="welcome__choice-label">{copy.welcome.roles[choice].label}</span>
                          <span className="welcome__choice-detail">{copy.welcome.roles[choice].detail}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <form className="welcome__form" onSubmit={submit}>
              <button type="button" className="welcome__back" onClick={() => setWho(null)}>
                <ArrowLeft size={18} weight="bold" aria-hidden="true" />
                {copy.welcome.back}
              </button>
              <RadixDialog.Title className="dialog__title">{copy.welcome.signInTitle(label)}</RadixDialog.Title>
              <Field
                label={copy.welcome.email}
                type="email"
                autoComplete="off"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <Field
                label={copy.welcome.password}
                type="password"
                autoComplete="off"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <p className="welcome__note" role={tried ? 'status' : undefined}>
                {copy.welcome.notYet}
              </p>
              <div className="dialog__actions">
                <Button type="button" variant="primary" onClick={() => void finish(who)}>
                  {copy.welcome.continueAs(label)}
                </Button>
                <Button type="submit" variant="secondary">
                  {copy.welcome.signIn}
                </Button>
              </div>
            </form>
          )}
          <RadixDialog.Close className="icon-button dialog__close" aria-label={copy.welcome.close}>
            <X size={24} weight="bold" aria-hidden="true" />
          </RadixDialog.Close>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
