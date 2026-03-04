import { lazy, ComponentType } from "react";

type LazyComponent<T extends ComponentType<any>> = React.LazyExoticComponent<T> & {
  preload: () => Promise<{ default: T }>;
};

export function lazyWithPreload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): LazyComponent<T> {
  const LazyComponent = lazy(factory) as LazyComponent<T>;
  LazyComponent.preload = factory;
  return LazyComponent;
}
