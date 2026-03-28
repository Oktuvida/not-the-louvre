export type HomeAuthUser = {
	authUserId: string;
	avatarOnboardingCompletedAt?: Date | null;
	avatarUrl?: string | null;
	email: string;
	id: string;
	image?: string | null;
	name?: string;
	nickname: string;
	role: string;
};

export type HomeAuthBootstrap =
	| {
			integrityFailure: null;
			onboarding: {
				status: 'complete' | 'needs-avatar';
			};
			status: 'authenticated';
			user: HomeAuthUser;
	  }
	| {
			integrityFailure: null;
			onboarding: null;
			status: 'signed-out';
			user: null;
	  }
	| {
			integrityFailure: {
				message: string;
				reason: string;
			};
			onboarding: null;
			status: 'integrity-failure';
			user: null;
	  };

export type HomeAuthActionName =
	| 'checkNickname'
	| 'recover'
	| 'saveAvatar'
	| 'signIn'
	| 'signOut'
	| 'signUp';
export type HomeAuthAvailability = 'available' | 'invalid' | 'taken';

type HomeAuthFailure = {
	action: HomeAuthActionName;
	code?: string;
	message: string;
};

export type HomeAuthActionData =
	| { action: 'checkNickname'; availability: HomeAuthAvailability }
	| { action: 'recover'; recoveryKey: string; rotatedRecoveryKey: string; success: true }
	| { action: 'saveAvatar'; avatarUrl: string; onboarding: 'complete'; success: true }
	| { action: 'signIn'; success: true }
	| { action: 'signOut'; success: true }
	| { action: 'signUp'; onboarding: 'needs-avatar'; recoveryKey: string; success: true }
	| HomeAuthFailure;

export type HomeAuthActionForm = HomeAuthActionData | null | undefined;
