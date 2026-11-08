import type { ContractTemplate } from '../types';

export const CONTRACTS: readonly ContractTemplate[] = [
	{
		id: 's1-1a',
		sector: 1,
		slot: 1,
		target: 'He',
		count: 1,
		modifier: null,
		brief: 'Deliver one helium. Try not to melt the carpet.'
	}
];

export function contractById(id: string): ContractTemplate {
	return CONTRACTS.find((contract) => contract.id === id) ?? CONTRACTS[0];
}
