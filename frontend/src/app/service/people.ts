import { Injectable } from '@angular/core';
import { PersonLocation } from '../interface/location';

@Injectable({
  providedIn: 'root',
})
export class People {
  protected readonly groups: string[] = ['Group A', 'Group B', 'Group C'];
  protected readonly people: PersonLocation[] = [];
  
  constructor() {
    // Move some people to nearby cities around Toronto (GTA)
    this.people = this.createPeopleWithRandomGroups([
      { name: 'Ava', lat: 43.6532, lng: -79.3832, neighborhood: 'Downtown Toronto' },
      { name: 'Noah', lat: 43.5934, lng: -79.6406, neighborhood: 'Mississauga' },
      { name: 'Mia', lat: 43.6614, lng: -79.3915, neighborhood: 'University District' },
      { name: 'Liam', lat: 43.7315, lng: -79.7624, neighborhood: 'Brampton' },
      { name: 'Sophia', lat: 43.8561, lng: -79.3370, neighborhood: 'Markham' },
      { name: 'Ethan', lat: 43.6681, lng: -79.4071, neighborhood: 'The Annex' },
      { name: 'Olivia', lat: 43.6414, lng: -79.3895, neighborhood: 'Harbourfront' },
      { name: 'Lucas', lat: 43.8372, lng: -79.5083, neighborhood: 'Vaughan' },
      { name: 'Amelia', lat: 43.4675, lng: -79.6877, neighborhood: 'Oakville' },
      { name: 'Benjamin', lat: 43.6752, lng: -79.2473, neighborhood: 'Scarborough' },
    ]);
  }

  getPeople(): PersonLocation[] {
      return this.people;
  }

  getGroups(): string[] {
      return this.groups;
  }

  private createPeopleWithRandomGroups( people: Array<Omit<PersonLocation, 'group'>>): PersonLocation[] {
    return people.map(person => {
      const randomGroup = this.groups[Math.floor(Math.random() * this.groups.length)];
      return {
        ...person,
        group: randomGroup,
      };
    });
  }
}
