import type { AxieAnimationDescriptor, AxieWeaponCapability } from './runtime.js';
export interface AxieAnimationPanelOptions {
    readonly mount: HTMLElement;
    readonly onPlay: (clip: AxieAnimationDescriptor) => void | Promise<void>;
    readonly onResumeLocomotion: () => void;
    readonly onEquipWeapon: (id?: string) => void;
    readonly onGameplayFocus?: () => void;
    readonly onOpenChange?: (open: boolean) => void;
}
export interface AxieAnimationPanelController {
    readonly host: HTMLElement;
    readonly isOpen: boolean;
    setAvailable(available: boolean): void;
    setAnimations(clips: readonly AxieAnimationDescriptor[]): void;
    setWeapons(weapons: readonly AxieWeaponCapability[]): void;
    setActive(name: string | undefined, overridden: boolean): void;
    setActiveWeapon(id: string | undefined, loading: string | undefined): void;
    open(): void;
    close(): void;
    toggle(): void;
    dispose(): void;
}
export declare function createAxieAnimationPanel(options: AxieAnimationPanelOptions): AxieAnimationPanelController;
//# sourceMappingURL=animation-panel.d.ts.map