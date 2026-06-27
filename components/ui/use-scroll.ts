'use client';
import { useSyncExternalStore } from 'react';

/**
 * Retorna `true` quando a página rolou além de `threshold` pixels.
 * Usa useSyncExternalStore para sincronizar com o scroll do window de forma
 * segura para SSR/hidratação (snapshot do servidor = false).
 */
export function useScroll(threshold: number) {
	const subscribe = (onChange: () => void) => {
		window.addEventListener('scroll', onChange, { passive: true });
		return () => window.removeEventListener('scroll', onChange);
	};

	return useSyncExternalStore(
		subscribe,
		() => window.scrollY > threshold,
		() => false,
	);
}
