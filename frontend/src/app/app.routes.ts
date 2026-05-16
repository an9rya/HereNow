import { Routes } from '@angular/router';
import { Group } from './component/group/group';
import { Map } from './component/map/map';

export const routes: Routes = [
	{ path: '', component: Map },
	{ path: 'group', component: Group },
];
